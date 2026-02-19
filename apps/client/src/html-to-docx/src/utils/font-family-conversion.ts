export const removeSimpleOrDoubleQuotes = /(["'])(.*?)\1/;

export const fontFamilyToTableObject = (
  fontFamilyString: any,
  fallbackFont: any,
) => {
  const fontFamilyElements = fontFamilyString
    ? fontFamilyString.split(",").map((fontName: any) => {
        const trimmedFontName = fontName.trim();

        if (removeSimpleOrDoubleQuotes.test(trimmedFontName)) {
          return trimmedFontName.match(removeSimpleOrDoubleQuotes)[2];
        }

        return trimmedFontName;
      })
    : [fallbackFont];

  return {
    fontName: fontFamilyElements[0],
    genericFontName: fontFamilyElements[fontFamilyElements.length - 1],
  };
};
