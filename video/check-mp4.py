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
s, e = find(data, [b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stsd"])
entry = s + 8
codec = data[entry + 4 : entry + 8].decode()
width, height = struct.unpack(">HH", data[entry + 32 : entry + 36])
print(f"кодек: {codec}, {width}×{height}")
avcc = data.find(b"avcC", entry)
profile, compat, level = data[avcc + 5], data[avcc + 6], data[avcc + 7]
print(f"H.264 profile_idc={profile} (100 = High), level={level / 10}")
s, e = find(data, [b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stsz"])
count = struct.unpack(">I", data[s + 8 : s + 12])[0]
print(f"кадров: {count}")
s, e = find(data, [b"moov", b"trak", b"mdia", b"minf", b"stbl", b"stss"])
print(f"ключевых кадров: {struct.unpack('>I', data[s + 4 : s + 8])[0]}")
