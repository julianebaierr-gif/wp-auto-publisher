import sharp from 'sharp';

export async function compressImageToDataUri(input: string | Buffer): Promise<string> {
  let buffer: Buffer;
  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      const match = input.match(/^data:[^;]+;base64,(.+)$/);
      if (match) buffer = Buffer.from(match[1], 'base64');
      else return input;
    } else if (input.startsWith('http')) {
      try {
        const res = await fetch(input);
        if (!res.ok) return input;
        buffer = Buffer.from(await res.arrayBuffer());
      } catch { return input; }
    } else return input;
  } else return '';
  try {
    const compressed = await sharp(buffer).resize(1200, 675, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    return 'data:image/jpeg;base64,' + compressed.toString('base64');
  } catch (err) {
    console.warn('Compression warning:', err);
    return typeof input === 'string' ? input : 'data:image/png;base64,' + buffer.toString('base64');
  }
}