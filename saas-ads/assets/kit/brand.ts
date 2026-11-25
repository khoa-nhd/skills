// Brand tokens for the whole ad. Change these first: colours, font, logo monogram.
// The defaults are a deep navy UI with a bright blue accent, which suits most dark-mode SaaS products.
import {loadFont} from '@remotion/google-fonts/BeVietnamPro';

// Pick a font that covers the caption language (Be Vietnam Pro covers Vietnamese and Latin).
export const {fontFamily} = loadFont('normal', {weights: ['400', '500', '600', '700', '800'], subsets: ['vietnamese', 'latin']});

export const BRAND = {
	name: 'Product',
	monogram: 'P', // text in the logo tile; replace the tile with an <Img> of the real logo if there is one
	url: 'product.app',
	tagline: 'One line promise',
};

export const K = {
	ink: '#0f2036', // text on light stages
	inkSoft: '#5d6f86',
	paper: '#f5f8fc', // light stage background
	night: '#07101d', // darkest background
	navy: '#0e1c2f',
	brand: '#2f6fe0', // primary accent
	brand2: '#5b9cff',
	sky: '#8fb6e8',
	amber: '#f0b25a', // "changed" / warning accent
	green: '#3ed598', // success
	rose: '#ef7d7d',
};

export const GRAD = `linear-gradient(100deg, ${K.brand} 0%, ${K.brand2} 55%, #7cc4ff 100%)`;
export const GRAD_DARK = `linear-gradient(100deg, #7cc4ff 0%, ${K.sky} 50%, #c9dcff 100%)`;
