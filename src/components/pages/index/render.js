import { imageUrl } from '@js/config/assets.js'

// textContent rather than innerText: these are plain labels, and innerText is
// rendering-dependent (it reads back empty inside a hidden element).
const setText = (selector, value) => {
	const element = document.querySelector(selector)
	if (element && typeof value === 'string') element.textContent = value
}

/**
 * Applies the config to the static part of the page: art and labels. Safe to
 * call repeatedly — the dev watcher re-runs it on every config.json edit. The
 * reels, balance and bet are driven by the SlotMachine class in index.js.
 */
export function renderLanding(config) {
	const { assets, texts, cta } = config

	const logo = document.querySelector('.game__logo img')
	if (logo) logo.src = imageUrl(assets.logo, 'logo')

	// Only the image itself — position/size stay in index.scss.
	const page = document.querySelector('.page')
	if (page) page.style.backgroundImage = `url("${imageUrl(assets.background, 'bg')}")`

	setText('.menu__credit span', texts.credit)
	setText('.menu__bet span', texts.bet)
	setText('.menu__title', texts.menuTitle)
	setText('.popup__title', texts.popupTitle)
	setText('.popup__text', texts.popupText)
	setText('.cta-button', texts.ctaButton)

	const ctaButton = document.querySelector('.cta-button')
	if (ctaButton) {
		ctaButton.href = cta.url
		ctaButton.target = cta.target
	}
}
