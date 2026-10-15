import { DEFAULT_CONFIG } from '@js/config/game.defaults.js'

// Game-specific devmenu field groups, concatenated with CORE_FIELDS (texts/CTA/
// sound) in index.js. See src/js/config/devmenu.js for the field shape.
//
// Deliberately file-only (edit public/config.json by hand): spins.*.result and
// spins.*.winLine — icon grids and row indices bound to the 5×3 / 3×3 reel
// layout, not safe to free-type; assets.* and cta.target — plumbing.

const SPIN_TYPE_HINT = 'loss | smallwin | bigwin'

// One group per scripted spin, derived from the defaults so the panel matches
// however many spins the game has.
const spinFields = (device) => DEFAULT_CONFIG.game.spins[device].map((_, i) => [
	{ path: `game.spins.${device}.${i}.type`, label: `Спін #${i + 1}: тип`, type: 'text', hint: SPIN_TYPE_HINT },
	{ path: `game.spins.${device}.${i}.winAmount`, label: `Спін #${i + 1}: виграш`, type: 'number', min: 0, step: 1 }
]).flat()

export const GAME_FIELDS = [
	['Гра', [
		{ path: 'game.balance', label: 'Стартовий баланс', type: 'number', min: 0, step: 1 },
		{ path: 'game.bet', label: 'Ставка', type: 'number', min: 0, step: 1 },
		{ path: 'game.betStep', label: 'Крок ставки', type: 'number', min: 0.01, step: 0.5 },
		{ path: 'game.minBet', label: 'Мін. ставка', type: 'number', min: 0.01, step: 1 },
		{ path: 'game.maxBet', label: 'Макс. ставка', type: 'number', min: 0.01, step: 1 },
		{ path: 'game.currency', label: 'Валюта', type: 'text' }
	]],
	['Тексти гри', [
		{ path: 'texts.credit', label: 'Підпис балансу', type: 'text' },
		{ path: 'texts.bet', label: 'Підпис ставки', type: 'text' },
		{ path: 'texts.menuTitle', label: 'Напис у меню', type: 'text' },
		{ path: 'texts.bigWin', label: 'Текст великого виграшу', type: 'text' }
	]],
	['Спіни (desktop)', spinFields('desktop')],
	['Спіни (mobile)', spinFields('mobile')],
	['Таймінги (мс)', [
		{ path: 'game.timing.spinDuration.desktop', label: 'Кручення desktop', type: 'number', min: 0, step: 50 },
		{ path: 'game.timing.spinDuration.mobile', label: 'Кручення mobile', type: 'number', min: 0, step: 50 },
		{ path: 'game.timing.stopDelay.desktop', label: 'Затримка колонки desktop', type: 'number', min: 0, step: 10 },
		{ path: 'game.timing.stopDelay.mobile', label: 'Затримка колонки mobile', type: 'number', min: 0, step: 10 },
		{ path: 'game.timing.stopDuration', label: 'Відскок при зупинці', type: 'number', min: 0, step: 50 },
		{ path: 'game.timing.startDelay', label: 'Затримка старту колонок', type: 'number', min: 0, step: 10 },
		{ path: 'game.timing.spinDistance.desktop', label: 'Іконок за спін desktop', type: 'number', min: 3, step: 1 },
		{ path: 'game.timing.spinDistance.mobile', label: 'Іконок за спін mobile', type: 'number', min: 3, step: 1 },
		{ path: 'game.timing.smallWinTime', label: 'Показ малого виграшу', type: 'number', min: 0, step: 100 },
		{ path: 'game.timing.bigWinTime', label: 'Показ великого виграшу', type: 'number', min: 0, step: 100 },
		{ path: 'game.timing.ctaDelay', label: 'Затримка попапу CTA', type: 'number', min: 0, step: 100 }
	]]
]
