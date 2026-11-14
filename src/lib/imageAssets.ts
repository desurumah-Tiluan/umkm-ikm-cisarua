import heroCisaruaImg from '../assets/images/hero_cisarua_umkm_1794547325202.jpg';
import kopiCisaruaImg from '../assets/images/product_kopi_cisarua_1794547324720.jpg';
import maduSusuImg from '../assets/images/product_madu_susu_1794547325141.jpg';
import anyamanBambuImg from '../assets/images/product_anyaman_bambu_1794547324450.jpg';
import sayurStroberiImg from '../assets/images/product_sayur_stroberi_1794547326168.jpg';
import batikKripikImg from '../assets/images/product_batik_kripik_1794547327121.jpg';

export const HERO_BANNER_IMAGE = heroCisaruaImg;

export const IMAGE_ASSET_OPTIONS = [
  { key: 'kopi', label: 'Kopi Arabika Cisarua', src: kopiCisaruaImg },
  { key: 'madu-susu', label: 'Madu Hutan & Susu Segar', src: maduSusuImg },
  { key: 'anyaman-bambu', label: 'Kerajinan Anyaman Bambu', src: anyamanBambuImg },
  { key: 'sayur-stroberi', label: 'Sayur Organik & Stroberi Puncak', src: sayurStroberiImg },
  { key: 'batik-kripik', label: 'Batik Ecoprint & Olahan Talas', src: batikKripikImg },
] as const;

const IMAGE_MAP: Record<string, string> = {
  hero: heroCisaruaImg,
  kopi: kopiCisaruaImg,
  'madu-susu': maduSusuImg,
  'anyaman-bambu': anyamanBambuImg,
  'sayur-stroberi': sayurStroberiImg,
  'batik-kripik': batikKripikImg,
};

export function resolveImageSrc(imageKey: string): string {
  if (!imageKey) return kopiCisaruaImg;
  if (IMAGE_MAP[imageKey]) return IMAGE_MAP[imageKey];
  if (
    imageKey.startsWith('http://') ||
    imageKey.startsWith('https://') ||
    imageKey.startsWith('/') ||
    imageKey.startsWith('data:image/')
  ) {
    return imageKey;
  }
  return kopiCisaruaImg;
}
