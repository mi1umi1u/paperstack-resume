/**
 * OCR 接口占位（R11，本期不实现）
 *
 * 以后接本地 OCR 库（tesseract.js）或 AI 视觉模型时，只需要在这里实现 recognizeImage，
 * 上层 ImportDialog 不用改：它只判断 ocrAvailable() 决定是否显示「扫描件识别」入口。
 */
export interface OcrResult {
  text: string
  confidence: number
}

export function ocrAvailable(): boolean {
  return false
}

export async function recognizeImage(_file: File): Promise<OcrResult> {
  throw new Error('OCR 还没接入。这一版请用「粘贴文本」导入扫描件的内容。')
}
