import * as path from 'node:path';

interface LocaleConfig {
  imagesDir: string;
  videosDir: string;
  acceptLanguage: string;
  headings: {
    modelDetails: string;
    season: string;
    price: string;
    colorVariations: string;
  };
  testData: {
    colors: string[];
    material: string;
    description: string;
  };
}

const CONFIGS: Record<string, LocaleConfig> = {
  de: {
    imagesDir: path.resolve(__dirname, '../../images/de'),
    videosDir: path.resolve(__dirname, '../../videos/de'),
    acceptLanguage: 'de-CH',
    headings: {
      modelDetails: 'Artikelangaben',
      season: 'Saison',
      price: 'Preis',
      colorVariations: 'Farb-Varianten',
    },
    testData: {
      colors: ['Schwarz', 'Weiss', 'Navy'],
      material: 'Bio-Baumwolle',
      description: 'Klassisches T-Shirt aus Bio-Baumwolle',
    },
  },
  en: {
    imagesDir: path.resolve(__dirname, '../../images/en'),
    videosDir: path.resolve(__dirname, '../../videos/en'),
    acceptLanguage: 'en',
    headings: {
      modelDetails: 'Model Details',
      season: 'Season',
      price: 'Price',
      colorVariations: 'Color Variations',
    },
    testData: {
      colors: ['Black', 'White', 'Navy'],
      material: 'Organic Cotton',
      description: 'Classic organic cotton t-shirt',
    },
  },
};

/**
 * Returns locale-specific config based on the Playwright project locale.
 * Accepts the full locale string (e.g. 'de-CH', 'en') and maps to config.
 */
export function getLocaleConfig(locale: string): LocaleConfig {
  const lang = locale.startsWith('de') ? 'de' : 'en';
  return CONFIGS[lang];
}
