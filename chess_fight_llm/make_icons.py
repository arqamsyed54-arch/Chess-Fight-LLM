"""Generate PWA icons with stdlib only (no Pillow): amber knight glyph on obsidian."""
import struct, zlib

BG = (11, 15, 23)
FG = (245, 158, 11)


def png(path: str, size: int):
    # amber rounded square + bold "CF" letters drawn as blocks (no font files)
    px = bytearray()
    for y in range(size):
        px.append(0)
        for x in range(size):
            nx, ny = x / size, y / size
            in_box = 0.12 < nx < 0.88 and 0.12 < ny < 0.88
            # letter C (left block with gap) and F (left bar + two arms)
            c = (0.22 < nx < 0.42 and ((0.3 < ny < 0.38) or (0.62 < ny < 0.7) or (0.3 < ny < 0.7 and nx < 0.28)))
            f = (0.52 < nx < 0.58 and 0.3 < ny < 0.7) or (0.52 < nx < 0.78 and 0.3 < ny < 0.37) or (0.52 < nx < 0.72 and 0.47 < ny < 0.53)
            if in_box and (c or f):
                px += bytes(FG)
            elif in_box:
                px += bytes(BG)
            else:
                px += bytes(BG)
    raw = bytes(px)
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) +
            chunk(b"IDAT", zlib.compress(bytes().join(bytes([0]) + raw[i * size * 3:(i + 1) * size * 3] for i in range(size)))) +
            chunk(b"IEND", b""))
    open(path, "wb").write(data)
    print("wrote", path)


if __name__ == "__main__":
    import os
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "static")
    png(os.path.join(d, "icon-192.png"), 192)
    png(os.path.join(d, "icon-512.png"), 512)
