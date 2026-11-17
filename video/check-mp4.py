"""Проверка готового MP4 без ffprobe: кодек, размер, число кадров, длительность, профиль H.264 (из avcC)."""
import struct
import sys

CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts"}


def boxes(data, start, end):
    i = start
    while i + 8 <= end:
        size, kind = struct.unpack(">I4s", data[i : i + 8])
        header = 8
        if size == 1:
            size = struct.unpack(">Q", data[i + 8 : i + 16])[0]
            header = 16
        elif size == 0:
            size = end - i
        yield kind, i + header, i + size
        i += size


def find(data, path, start=0, end=None):
    end = len(data) if end is None else end
    for kind, s, e in boxes(data, start, end):
        if kind == path[0]:
            return (s, e) if len(path) == 1 else find(data, path[1:], s, e)
    return None


data = open(sys.argv[1], "rb").read()
top = [k.decode() for k, _, _ in boxes(data, 0, len(data))]
print("верхние боксы:", " ".join(top))
s, e = find(data, [b"moov", b"mvhd"])
version = data[s]
timescale, duration = struct.unpack(">II", data[s + 12 : s + 20]) if version == 0 else struct.unpack(">IQ", data[s + 20 : s + 32])
print(f"длительность: {duration / timescale:.2f} с")
moov = find(data, [b"moov"])
for kind, ts, te in boxes(data, *moov):
    if kind != b"trak":
        continue
    hs, _ = find(data, [b"mdia", b"hdlr"], ts, te)
    handler = data[hs + 8 : hs + 12].decode()
    ms, _ = find(data, [b"mdia", b"mdhd"], ts, te)
    scale, dur = struct.unpack(">II", data[ms + 12 : ms + 20]) if data[ms] == 0 else struct.unpack(">IQ", data[ms + 20 : ms + 32])
    ss, se = find(data, [b"mdia", b"minf", b"stbl", b"stsd"], ts, te)
    entry = ss + 8
    codec = data[entry + 4 : entry + 8].decode()
    zs, _ = find(data, [b"mdia", b"minf", b"stbl", b"stsz"], ts, te)
    count = struct.unpack(">I", data[zs + 8 : zs + 12])[0]
    if handler == "vide":
        width, height = struct.unpack(">HH", data[entry + 32 : entry + 36])
        avcc = data.find(b"avcC", entry)
        print(f"видео: {codec} {width}×{height}, профиль {data[avcc + 5]} (100 = High), уровень {data[avcc + 7] / 10}, кадров {count}, {dur / scale:.2f} с")
    else:
        channels = struct.unpack(">H", data[entry + 24 : entry + 26])[0]
        rate = struct.unpack(">I", data[entry + 32 : entry + 36])[0]
        print(f"звук: {codec}, {rate >> 16} Гц, каналов {channels}, фрагментов {count}, {dur / scale:.2f} с")
