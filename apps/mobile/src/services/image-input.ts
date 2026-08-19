import {
  ImageManipulator,
  SaveFormat,
} from "expo-image-manipulator";

export type PreparedImage = {
  dataUrl: string;
  height: number;
  width: number;
};

/** Re-encoding strips source metadata and bounds payload size before upload. */
export async function prepareImageDataUrl(
  uri: string,
  options: { maxEdge: number; quality: number },
): Promise<PreparedImage> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const longestEdge = Math.max(source.width, source.height);
  const scale = Math.min(1, options.maxEdge / longestEdge);
  const context = ImageManipulator.manipulate(source);

  if (scale < 1) {
    context.resize({
      height: Math.round(source.height * scale),
      width: Math.round(source.width * scale),
    });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    base64: true,
    compress: options.quality,
    format: SaveFormat.JPEG,
  });
  if (!saved.base64) throw new Error("IMAGE_ENCODING_FAILED");

  return {
    dataUrl: `data:image/jpeg;base64,${saved.base64}`,
    height: saved.height,
    width: saved.width,
  };
}
