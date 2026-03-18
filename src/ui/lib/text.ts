export function fitText(text: string, width: number) {
  if (width <= 0) {
    return "";
  }

  if (text.length <= width) {
    return text;
  }

  if (width === 1) {
    return ".";
  }

  return `${text.slice(0, width - 1)}.`;
}

export function padText(text: string, width: number) {
  const trimmed = fitText(text, width);
  return trimmed.padEnd(width, " ");
}
