"""
subset-fonts.py — サイトで使う文字だけを抜き出した Web フォント（woff2）を作る

  日本語フォントは1ファイル 5〜10MB あるので、そのまま置くと重すぎる。
  このリポジトリの HTML / JS に出てくる文字＋かな・英数・記号だけを残して
  assets/fonts/ に書き出す。見出しの文言を変えて「一部の字だけ書体が違う」
  ようになったら、これを実行し直せば直る。

  使い方（フォントが入っている PC で）:
      pip install fonttools brotli
      python tools/subset-fonts.py

  元のフォントは Windows のユーザーフォント フォルダから読む。
  別の場所にあるときは  python tools/subset-fonts.py --src <フォルダ>

  どれも SIL Open Font License 1.1。OFL では、手を加えた（＝文字を間引いた）
  フォントに元の予約フォント名を使えないので、中の名前を CCM Display /
  CCM Mono に付け替える。著作権表示とライセンス文はそのまま残す。
"""
import argparse, os, re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'fonts'

FONTS = [
    # (元ファイル, 出力, 新しいファミリー名, ウェイト名, 残す文字)
    # 見出し：コーポレート・ロゴ Bold（LOGOTYPE.JP）。幾何学的で、部の六角形のマークと相性がいい。
    # ※日本語サイトでは明朝体は敬遠されるので、見出しにも使わない
    ('Corporate-Logo-Bold-ver3.otf', 'ccm-display.woff2',     'CCM Display', 'Regular', 'all'),
    ('PlemolJPConsole-Regular.ttf', 'ccm-mono-regular.woff2', 'CCM Mono',   'Regular', 'all'),
    # 太字は数字（作品数など）にしか使わないので、英数と記号だけ
    ('PlemolJPConsole-Bold.ttf',    'ccm-mono-bold.woff2',    'CCM Mono',   'Bold',    'ascii'),
]

# どのページにも出うる文字（あとで文言を足しても困らないように、かなは全部入れる）
BASE = set()
for a, b in [(0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2030, 0x203B), (0x2190, 0x2199),
             (0x2500, 0x2503), (0x25A0, 0x25CF), (0x2605, 0x2606), (0x3000, 0x303F),
             (0x3041, 0x309F), (0x30A0, 0x30FF), (0xFF01, 0xFF5E), (0x2032, 0x2033), (0x00B0, 0x00B0)]:
    BASE.update(range(a, b + 1))
BASE.update(map(ord, 'ʰᵐ−×÷±'))


def used_chars():
    chars = set()
    files = list(ROOT.glob('*.html')) + list((ROOT / 'assets' / 'js').glob('*.js'))
    for f in files:
        chars.update(ord(c) for c in f.read_text(encoding='utf-8', errors='ignore'))
    # 漢字など、ASCII 以外で「字」として意味のあるものだけ残す
    return {c for c in chars if c >= 0x2E80 or c in BASE}


def rename(font, family, style):
    name = font['name']
    full = f'{family} {style}' if style != 'Regular' else family
    ps = (family + '-' + style).replace(' ', '')
    keep = {0, 7, 8, 9, 11, 12, 13, 14}              # 著作権・商標・作者・ライセンスは残す
    name.names = [r for r in name.names if r.nameID in keep]
    for nid, val in [(1, family), (2, style if style in ('Regular', 'Bold') else 'Regular'),
                     (3, f'{ps};subset for computer-club-mita'), (4, full), (6, ps),
                     (16, family), (17, style)]:
        name.setName(val, nid, 3, 1, 0x409)
    # CFF の中にも名前がある（OTF の場合）
    if 'CFF ' in font:
        top = font['CFF '].cff
        top.fontNames = [ps]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'Windows', 'Fonts'))
    args = ap.parse_args()

    used = used_chars()
    chars = sorted(BASE | used)
    OUT.mkdir(parents=True, exist_ok=True)
    print(f'{len(chars)} 文字を残します')

    ascii_only = list(range(0x20, 0x7F)) + [0xA0, 0x2212, 0x2013, 0x2014]
    for src, dst, family, style, which in FONTS:
        p = Path(args.src) / src
        if not p.exists():
            sys.exit(f'見つかりません: {p}')
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']      # palt（字詰め）や kern を残す
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.hinting = False
        font = subset.load_font(str(p), opts)
        if which == 'all':
            have = set(font.getBestCmap())
            # サイトで実際に使っている字のうち、この書体に無いもの
            miss = [chr(c) for c in sorted(used) if c >= 0x3000 and c not in have]
            if miss:
                print(f'  ！ {src} に無い字（別の書体で出ます）: {"".join(miss[:40])}')
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=chars if which == 'all' else ascii_only)
        sub.subset(font)
        rename(font, family, style)
        subset.save_font(font, str(OUT / dst), opts)
        print(f'  {src:32s} -> assets/fonts/{dst}  {(OUT / dst).stat().st_size / 1024:,.0f} KB')


if __name__ == '__main__':
    main()
