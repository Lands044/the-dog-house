import { DEFAULT_CONFIG as CORE_DEFAULTS } from '@js/config/defaults.js'

// The Dog House — slot machine defaults, merged on top of the core shape
// (texts/cta/sound/dev). Mirrors public/config.json.
//
// Named game.defaults.js (not defaults.js) deliberately: the core kit already
// installs its own src/js/config/defaults.js at that exact path.
//
// Core texts this game has no element for (a text action button — the spin
// button is an image — and a rotate-device overlay) are dropped here rather than
// edited out of the shared core defaults. Same for the core `background` asset
// key, replaced with this game's own file name.
const { actionButton, rotateNotice, ...coreTexts } = CORE_DEFAULTS.texts

export const DEFAULT_CONFIG = {
	...CORE_DEFAULTS,

	// The popup's CTA was a plain `href="#"` before the config kit — kept as-is
	// so behavior doesn't change until a real URL is set.
	cta: {
		url: "#",
		target: "_self"
	},

	texts: {
		...coreTexts,
		popupTitle: "Congratulations!",
		popupText: "Ready to continue playing?",
		ctaButton: "Download Now",
		credit: "Credit",
		bet: "Bet",
		menuTitle: "Place your bets!",
		bigWin: "BIG WIN!"
	},

	game: {
		currency: "$",
		balance: 1000,
		bet: 2,
		betStep: 1,
		minBet: 1,
		maxBet: 48,

		// Scripted spins, played in order; the CTA popup opens after the last one.
		// type: loss | smallwin | bigwin
		// winAmount: credited to the balance after the spin
		// winLine: row index (0-2) per column for the win line, null = no point
		// result: per column, the icon numbers (1-8) from top to bottom
		// desktop = 5 columns, mobile = 3 columns (also used on small mobile).
		spins: {
			desktop: [
				{
					type: "loss",
					winAmount: 0,
					winLine: null,
					result: [
						[2, 4, 1],
						[3, 5, 2],
						[1, 7, 4],
						[6, 2, 5],
						[4, 1, 3]
					]
				},
				{
					type: "smallwin",
					winAmount: 50,
					winLine: [1, 1, 1, 1, null],
					result: [
						[3, 1, 2],
						[7, 1, 8],
						[5, 1, 6],
						[2, 1, 3],
						[5, 6, 7]
					]
				},
				{
					type: "bigwin",
					winAmount: 150,
					winLine: [1, 1, 1, 2, 2],
					result: [
						[2, 4, 7],
						[5, 4, 2],
						[3, 4, 8],
						[2, 5, 4],
						[5, 3, 4]
					]
				}
			],
			mobile: [
				{
					type: "loss",
					winAmount: 0,
					winLine: null,
					result: [
						[4, 1, 7],
						[5, 2, 8],
						[7, 4, 3]
					]
				},
				{
					type: "smallwin",
					winAmount: 50,
					winLine: [1, 1, 1],
					result: [
						[2, 1, 5],
						[7, 1, 2],
						[6, 1, 8]
					]
				},
				{
					type: "bigwin",
					winAmount: 150,
					winLine: [1, 1, 1],
					result: [
						[5, 4, 8],
						[3, 4, 2],
						[2, 4, 6]
					]
				}
			]
		}
	},

	assets: {
		logo: "logo",
		background: "bg",
		sounds: {
			spin: "spin",
			win: "win2",
			select: "select"
		}
	}
}
