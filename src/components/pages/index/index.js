import ConfettiAnimation from './confetti.js';
import { loadConfig, watchConfig } from '@js/config/config.js';
import { registerGameConfig } from '@js/config/normalize.js';
import { DEFAULT_CONFIG } from '@js/config/game.defaults.js';
import { soundUrl } from '@js/config/assets.js';
import { renderLanding } from './render.js';
import { GAME_FIELDS } from './devmenu.fields.js';

// Підключаємо нормалізатор game-блоку до core-конфігу ДО loadConfig()
registerGameConfig();

class SlotMachine {
	// landingConfig — рантайм-конфіг з public/config.json (this.config нижче —
	// конфіг поточного брейкпоінта, як і раніше)
	constructor(landingConfig) {
		this.landingConfig = landingConfig;
		const game = landingConfig.game;

		// Таймери та обробники відстежуються, щоб destroy() міг їх зняти
		// при перезапуску гри після зміни конфігу
		this.timers = new Set();
		this.listeners = [];

		// DOM елементи
		this.drumSpinner = document.querySelector('.drum__spinner');
		this.popup = document.querySelector('.popup');
		this.buttonsWrap = document.querySelector('.menu__right');

		// Анімація конфеті
		this.confettiAnimation = null;

		// Кнопки
		this.spinButton = document.querySelector('.menu__button-spin');
		this.autoButton = null;
		this.soundButton = document.querySelector('.menu__sound');
		this.minusButton = document.querySelector('.menu__minus');
		this.plusButton = document.querySelector('.menu__plus');

		// Елементи UI
		this.balanceElement = document.querySelector('.menu__value-all');
		this.betElement = document.querySelector('.menu__value-win');

		// Стан гри
		this.spinCount = 0;
		this.isSpinning = false;
		this.isSoundEnabled = landingConfig.sound.enabled;

		// Фінансові значення
		this.currency = game.currency;
		this.balance = game.balance;
		this.bet = game.bet;
		this.betStep = game.betStep;
		this.minBet = game.minBet;
		this.maxBet = game.maxBet;

		// Брейкпоінти: desktop (>767.98px), mobile (<=767.98px), mobileSmall (<=479.98 && <=800px height)
		this.breakpoints = {
			desktop: {
				minWidth: 767.98,
				cols: 5,
				rows: 3,
				iconHeight: 150
			},
			mobile: {
				minWidth: 0,
				cols: 3,
				rows: 3,
				iconHeight: 140
			},
			mobileSmall: {
				minWidth: 0,
				cols: 3,
				rows: 3,
				iconHeight: 115
			}
		};

		// Поточна конфігурація
		this.config = this.getConfigForCurrentBreakpoint();

		// Звуки
		this.sounds = {
			spin: this.createSound('spin'),
			win: this.createSound('win'),
			select: this.createSound('select')
		};

		// Іконки (8 типів)
		this.icons = 8;
		this.iconsPerReel = 100;

		// Елементи Lines
		this.linesItems = document.querySelectorAll('.lines__item');
		this.linesContainer = document.querySelector('.drum');

		// Патерни ліній для кожного значення
		// Desktop: 5 колонок, 4 рядки (0-3)
		// Mobile: 3 колонки, 3 рядки (0-2)
		this.linePatterns = {
			100: this.generateRandomLines(20),
			80: this.generateRandomLines(16),
			60: this.generateRandomLines(12),
			40: this.generateRandomLines(8),
			20: this.generateRandomLines(4)
		};

		// Предустановлені результати спінів — з конфігу (game.spins)
		// Desktop: 5 колонок по 3 іконки, Mobile: 3 колонки по 3 іконки
		// winLine: масив рядків (0-2) де знаходяться виграшні іконки
		this.predefinedResults = game.spins;

		this.init();
	}

	createSound(key) {
		const { assets, sound } = this.landingConfig;
		const audio = new Audio(soundUrl(assets.sounds?.[key], DEFAULT_CONFIG.assets.sounds[key]));
		audio.volume = sound.volume;
		return audio;
	}

	delay(callback, time) {
		const id = setTimeout(() => {
			this.timers.delete(id);
			callback();
		}, time);
		this.timers.add(id);
		return id;
	}

	on(target, event, handler) {
		target.addEventListener(event, handler);
		this.listeners.push([target, event, handler]);
	}

	// Знімає таймери/обробники та повертає DOM у початковий стан —
	// викликається перед перезапуском гри з новим конфігом
	destroy() {
		this.timers.forEach(id => clearTimeout(id));
		this.timers.clear();
		this.listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler));
		this.listeners = [];

		this.stopAllSounds();
		this.confettiAnimation?.destroy();
		this.confettiAnimation = null;

		this.popup.classList.remove('show');
		this.buttonsWrap.classList.remove('hidden');
		this.spinButton.classList.remove('disabled');
		this.soundButton.classList.remove('sound-off');
		this.drumSpinner.classList.remove('bigwin-animation', 'smallwin-animation');
		this.drumSpinner.style.borderRadius = '';
	}

	getCurrentBreakpoint() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const isTouch = window.matchMedia('(pointer: coarse)').matches;
		if (!isTouch || width > this.breakpoints.desktop.minWidth) {
			return 'desktop';
		}
		if (width <= 479.98 && height <= 800) {
			return 'mobileSmall';
		}
		return 'mobile';
	}

	getConfigForCurrentBreakpoint() {
		const breakpoint = this.getCurrentBreakpoint();
		const config = { ...this.breakpoints[breakpoint], breakpoint };
		if (breakpoint === 'desktop' && window.innerHeight <= 800) {
			config.iconHeight = 115;
		}
		return config;
	}

	getResultsForCurrentBreakpoint() {
		const breakpoint = this.getCurrentBreakpoint();
		return this.predefinedResults[breakpoint] ?? this.predefinedResults['mobile'];
	}

	init() {
		// Створюємо структуру барабанів зі стрічками
		this.createReels();

		// Обробники кнопок спіну
		this.on(this.spinButton, 'click', (e) => {
			e.preventDefault();
			this.handleSpin();
		});

		// Обробник кнопки звуку
		this.on(this.soundButton, 'click', (e) => {
			e.preventDefault();
			this.toggleSound();
		});
		this.soundButton.classList.toggle('sound-off', !this.isSoundEnabled);

		// Обробники кнопок ставки
		if (this.minusButton) {
			this.on(this.minusButton, 'click', (e) => {
				e.preventDefault();
				this.decreaseBet();
			});
		}

		if (this.plusButton) {
			this.on(this.plusButton, 'click', (e) => {
				e.preventDefault();
				this.increaseBet();
			});
		}

		// Оновлення при зміні розміру вікна
		this.on(window, 'resize', () => {
			this.handleResize();
		});

		// Обробники кнопок Lines
		this.linesItems.forEach((item) => {
			this.on(item, 'click', () => {
				this.handleLinesClick(item);
			});
		});

		// Оновлюємо UI
		this.updateUI();
	}

	// Створює структуру барабанів зі стрічками для анімації
	createReels() {
		// Очищаємо існуючу розмітку
		this.drumSpinner.innerHTML = '';

		const cols = this.config.cols;
		const rows = this.config.rows;
		const iconHeight = this.config.iconHeight;

		// Створюємо колонки
		for (let colIndex = 0; colIndex < cols; colIndex++) {
			const column = document.createElement('div');
			column.className = 'drum__column';
			column.dataset.column = colIndex;

			// Створюємо стрічку (strip) з іконками
			const strip = document.createElement('div');
			strip.className = 'drum__strip';

			// Випадкове зміщення для кожної колонки
			const randomOffset = Math.floor(Math.random() * this.icons);

			// Додаємо predefined комбінації на початок стрічки
			const results = this.getResultsForCurrentBreakpoint();
			results.forEach((result) => {
				const columnIcons = result.result[colIndex];
				if (columnIcons) {
					columnIcons.forEach((iconNum) => {
						const icon = document.createElement('div');
						icon.className = 'drum__image';
						icon.innerHTML = `<img src="@img/icon/icon-${iconNum}.png" alt="Icon ${iconNum}">`;
						strip.appendChild(icon);
					});
				}
			});

			// Генеруємо випадкові іконки для стрічки після predefined
			for (let i = 0; i < this.iconsPerReel; i++) {
				const iconNum = ((i + randomOffset) % this.icons) + 1;
				const icon = document.createElement('div');
				icon.className = 'drum__image';
				icon.innerHTML = `<img src="@img/icon/icon-${iconNum}.png" alt="Icon ${iconNum}">`;
				strip.appendChild(icon);
			}

			column.appendChild(strip);
			this.drumSpinner.appendChild(column);
		}

		// Встановлюємо початкові позиції
		this.initializePositions();
	}

	// Повертає реальну висоту іконки з DOM
	getIconHeight() {
		const firstIcon = this.drumSpinner.querySelector('.drum__image');
		if (firstIcon) {
			return firstIcon.getBoundingClientRect().height;
		}
		return this.config.iconHeight;
	}

	// Встановлює початкові позиції стрічок
	initializePositions() {
		const columns = this.drumSpinner.querySelectorAll('.drum__column');
		const iconHeight = this.getIconHeight();
		// Кількість predefined іконок на початку стрічки (щоб не показувати їх одразу)
		const results = this.getResultsForCurrentBreakpoint();
		const predefinedCount = results.reduce((sum, r) => sum + (r.result[0] ? r.result[0].length : 0), 0);

		columns.forEach((column) => {
			const strip = column.querySelector('.drum__strip');
			// Початкова позиція — після predefined блоку + випадковий зсув
			const randomOffset = Math.floor(Math.random() * this.icons) * iconHeight;
			strip.style.transform = `translateY(-${predefinedCount * iconHeight + randomOffset}px)`;
		});
	}

	// Обробка зміни розміру вікна
	handleResize() {
		const newConfig = this.getConfigForCurrentBreakpoint();
		if (newConfig.breakpoint !== this.config.breakpoint) {
			this.config = newConfig;
			this.spinCount = 0;
			this.createReels();
			// Перегенеровуємо патерни ліній для нового брейкпоінта
			this.regenerateLinePatterns();
			// Видаляємо відображені лінії
			this.removePaylines();
		}
	}

	// Обробка спіну
	async handleSpin() {
		if (this.isSpinning) return;

		if (this.balance < this.bet) {
			console.log('Недостатньо коштів');
			return;
		}

		const results = this.getResultsForCurrentBreakpoint();

		if (this.spinCount >= results.length) {
			console.log('Всі спіни використано');
			return;
		}

		this.isSpinning = true;

		// Віднімаємо ставку
		this.balance -= this.bet;
		this.updateUI();

		// Блокуємо кнопки
		this.disableSpinButtons();

		// Звук спіну
		this.playSound('spin');

		const currentResult = results[this.spinCount];

		// Запускаємо анімацію обертання
		await this.spin(currentResult);

		// Показуємо результат
		this.showResult(currentResult);

		// Додаємо виграш
		if (currentResult.winAmount > 0) {
			this.balance += currentResult.winAmount;
			this.updateUI();
		}

		this.spinCount++;
		this.isSpinning = false;

		if (this.spinCount >= results.length) {
			this.showCTA();
		}
		// Кнопки розблоковуються після завершення анімації виграшу в showResult
	}

	// Анімація обертання всіх колонок
	async spin(result) {
		const columns = this.drumSpinner.querySelectorAll('.drum__column');
		const isMobile = this.config.cols === 3;
		const baseSpinDuration = isMobile ? 2500 : 900; // мінімальний час кручення першої колонки
		const stopDelay        = isMobile ? 250 : 350;  // додаткова затримка кожної наступної колонки
		const stopDuration     = 500; // тривалість фази overshoot
		const startDelay       = 80;  // затримка старту між колонками

		const spinPromises = Array.from(columns).map((column, colIndex) => {
			return new Promise((resolve) => {
				this.delay(() => {
					// Кожна колонка крутиться лінійно рівно до свого моменту зупинки
					const spinDuration = baseSpinDuration + colIndex * stopDelay;
					this.spinColumn(column, result.result[colIndex], spinDuration, stopDuration);
					this.delay(resolve, spinDuration + stopDuration);
				}, colIndex * startDelay);
			});
		});

		await Promise.all(spinPromises);
	}

	// Анімація обертання однієї колонки
	// Фаза 1: лінійний прокрут від startOffset → midOffset протягом spinDuration
	// Фаза 2: overshoot від midOffset → finalOffset (відскок назад на місце)
	spinColumn(column, targetIcons, spinDuration, stopDuration) {
		const strip = column.querySelector('.drum__strip');
		const iconHeight = this.getIconHeight();

		const targetPosition = this.findSequencePosition(strip, targetIcons);
		if (targetPosition === -1) {
			console.log('Послідовність не знайдена');
			return;
		}

		const finalOffset = targetPosition * iconHeight;

		// startOffset > midOffset > finalOffset
		// Фаза 1 проходить startOffset→midOffset лінійно за spinDuration
		// Фаза 2 проходить midOffset→finalOffset з overshoot за stopDuration
		const isMobile = this.config.cols === 3;
		const stopDistance = iconHeight * 3;
		const spinDistance = iconHeight * (isMobile ? 58 : 28);
		const midOffset   = finalOffset + stopDistance;
		const startOffset = midOffset + spinDistance;

		// Фаза 0: стрибок до startOffset без анімації
		strip.style.transition = 'none';
		strip.style.transform = `translateY(-${startOffset}px)`;
		strip.offsetHeight;

		// Фаза 1: лінійний прокрут з blur — кожна колонка крутиться свій час
		strip.classList.add('active');
		strip.style.transition = `transform ${spinDuration}ms linear`;
		strip.style.transform = `translateY(-${midOffset}px)`;

		// Фаза 2: одразу після закінчення фази 1 — overshoot до finalOffset
		this.delay(() => {
			strip.classList.remove('active');
			strip.style.transition = `transform ${stopDuration}ms cubic-bezier(0.22, 1.3, 0.36, 1)`;
			strip.style.transform = `translateY(-${finalOffset}px)`;
		}, spinDuration);
	}

	// Знаходить позицію послідовності іконок у стрічці
	findSequencePosition(strip, targetIcons) {
		const icons = strip.querySelectorAll('.drum__image img');

		// Шукаємо з початку стрічки (там predefined комбінації)
		for (let i = 0; i <= icons.length - targetIcons.length; i++) {
			let found = true;

			for (let j = 0; j < targetIcons.length; j++) {
				const img = icons[i + j];
				if (!img) {
					found = false;
					break;
				}

				const iconNum = this.getIconNumber(img);
				if (iconNum !== targetIcons[j]) {
					found = false;
					break;
				}
			}

			if (found) {
				return i;
			}
		}

		return -1;
	}

	// Отримує номер іконки з src
	getIconNumber(img) {
		const src = img.getAttribute('src');
		const match = src.match(/icon-(\d+)\.png/);
		return match ? parseInt(match[1]) : 1;
	}

	// Показ результату
	showResult(result) {
		if (result.type === 'bigwin') {
			this.playSound('win');
			this.drumSpinner.classList.add('bigwin-animation');
			this.drumSpinner.style.borderRadius = '16px';

			// Більше флешів для bigwin
			this.createWinEffects(24);

			// Показуємо "BIG WIN!" текст
			this.showBigWinText();

			// Малюємо виграшну лінію з невеликою затримкою
			this.delay(() => {
				if (result.winLine) {
					this.drawWinLine(result.winLine);
				}
			}, 300);

			this.delay(() => {
				this.drumSpinner.classList.remove('bigwin-animation');
				this.drumSpinner.style.borderRadius = '';
				this.removeBigWinText();
				this.removeWinLine();
				this.enableSpinButtons();
			}, 3000);

		} else if (result.type === 'smallwin') {
			this.playSound('win');
			this.drumSpinner.classList.add('smallwin-animation');
			this.drumSpinner.style.borderRadius = '16px';

			// Малюємо виграшну лінію
			if (result.winLine) {
				this.drawWinLine(result.winLine);
			}

			this.delay(() => {
				this.drumSpinner.classList.remove('smallwin-animation');
				this.drumSpinner.style.borderRadius = '';
				this.removeWinLine();
				this.enableSpinButtons();
			}, 1500);

		} else {
			// Програш - одразу розблоковуємо кнопки
			this.enableSpinButtons();
		}
	}

	// Малює виграшну лінію через SVG
	drawWinLine(winLine) {
		const columns = this.drumSpinner.querySelectorAll('.drum__column');
		const iconHeight = this.getIconHeight();
		const spinnerRect = this.drumSpinner.getBoundingClientRect();
		// stroke-width відносний до ширини барабана — не залежить від zoom
		const sw = spinnerRect.width * 0.0075;
		const swDot = spinnerRect.width * 0.004;
		const rDot = spinnerRect.width * 0.01;

		// Створюємо SVG елемент
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'win-line-svg');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		svg.style.position = 'absolute';
		svg.style.top = '0';
		svg.style.left = '0';
		svg.style.pointerEvents = 'none';
		svg.style.zIndex = '50';
		svg.style.overflow = 'visible';

		// Збираємо точки для лінії
		const points = [];

		winLine.forEach((rowIndex, colIndex) => {
			if (rowIndex === null || colIndex >= columns.length) return;

			const column = columns[colIndex];
			const colRect = column.getBoundingClientRect();

			// Центр іконки
			const x = colRect.left - spinnerRect.left + colRect.width / 2;
			const y = (rowIndex + 0.5) * iconHeight;

			points.push({ x, y });
		});

		if (points.length < 2) return;

		// Створюємо polyline для лінії
		const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
		polyline.setAttribute('points', pointsStr);
		polyline.setAttribute('class', 'win-line');
		polyline.style.strokeWidth = `${sw}px`;

		svg.appendChild(polyline);

		// Додаємо кола на кожній точці
		points.forEach((point) => {
			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', point.x);
			circle.setAttribute('cy', point.y);
			circle.setAttribute('r', `${rDot}`);
			circle.setAttribute('class', 'win-line-dot');
			circle.style.strokeWidth = `${swDot}px`;
			svg.appendChild(circle);
		});

		this.drumSpinner.appendChild(svg);

		// Застосовуємо ефекти до іконок (затемнення та хитання)
		this.applyWinIconEffects(winLine);

		// Анімація появи
		this.delay(() => {
			svg.classList.add('visible');
		}, 50);
	}

	// Застосовує ефекти до іконок: затемнення невиграшних та хитання виграшних
	applyWinIconEffects(winLine) {
		const columns = this.drumSpinner.querySelectorAll('.drum__column');
		const rows = this.config.rows;
		const iconHeight = this.getIconHeight();

		columns.forEach((column, colIndex) => {
			const strip = column.querySelector('.drum__strip');
			const icons = strip.querySelectorAll('.drum__image');
			const winRowIndex = winLine[colIndex];

			// Визначаємо видимі іконки на основі поточної позиції strip
			const transform = strip.style.transform;
			const match = transform.match(/translateY\(-?(\d+)px\)/);
			const currentOffset = match ? parseInt(match[1]) : 0;
			const visibleStartIndex = Math.round(currentOffset / iconHeight);

			for (let i = 0; i < rows; i++) {
				const iconIndex = visibleStartIndex + i;
				const icon = icons[iconIndex];

				if (!icon) continue;

				if (winRowIndex !== null && i === winRowIndex) {
					// Виграшна іконка - додаємо хитання та фон вогню
					icon.classList.add('winning');
					const fire = document.createElement('div');
					fire.className = 'win-fire';
					icon.appendChild(fire);
				} else {
					// Невиграшна іконка - затемнюємо
					icon.classList.add('dimmed');
				}
			}
		});
	}

	// Видаляє ефекти з іконок
	removeWinIconEffects() {
		const icons = this.drumSpinner.querySelectorAll('.drum__image');
		icons.forEach((icon) => {
			icon.classList.remove('winning', 'dimmed');
			const fire = icon.querySelector('.win-fire');
			if (fire) fire.remove();
		});
	}

	// Видаляє виграшну лінію
	removeWinLine() {
		const svg = this.drumSpinner.querySelector('.win-line-svg');
		if (svg) {
			svg.classList.remove('visible');
			this.delay(() => svg.remove(), 300);
		}
		// Видаляємо ефекти з іконок
		this.removeWinIconEffects();
	}

	// Ефекти виграшу
	createWinEffects(count = 12) {
		for (let i = 0; i < count; i++) {
			this.delay(() => {
				const flash = document.createElement('div');
				flash.className = 'win-flash';
				flash.style.left = `${Math.random() * 100}%`;
				flash.style.top = `${Math.random() * 100}%`;
				this.drumSpinner.appendChild(flash);

				this.delay(() => flash.remove(), 600);
			}, i * 100);
		}
	}

	// Показує "BIG WIN!" текст поверх барабанів
	showBigWinText() {
		const el = document.createElement('div');
		el.className = 'bigwin-text';
		el.textContent = this.landingConfig.texts.bigWin;
		this.drumSpinner.appendChild(el);

		this.delay(() => el.classList.add('visible'), 50);
	}

	// Видаляє "BIG WIN!" текст
	removeBigWinText() {
		const el = this.drumSpinner.querySelector('.bigwin-text');
		if (el) {
			el.classList.remove('visible');
			this.delay(() => el.remove(), 400);
		}
	}

	// Показ CTA popup
	showCTA() {
		this.buttonsWrap.classList.add('hidden');

		this.delay(() => {
			this.popup.classList.add('show');

			// Запускаємо анімацію конфеті
			if (!this.confettiAnimation) {
				this.confettiAnimation = new ConfettiAnimation(this.popup);
			}
		}, 1500);
	}

	// Перемикання звуку
	toggleSound() {
		this.isSoundEnabled = !this.isSoundEnabled;

		if (this.isSoundEnabled) {
			this.soundButton.classList.remove('sound-off');
		} else {
			this.soundButton.classList.add('sound-off');
			this.stopAllSounds();
		}
	}

	// Відтворення звуку
	playSound(soundName) {
		if (!this.isSoundEnabled) return;

		const sound = this.sounds[soundName];
		if (sound) {
			sound.currentTime = 0;
			sound.play().catch(error => {
				console.log('Помилка відтворення звуку:', error);
			});
		}
	}

	// Зупинка всіх звуків
	stopAllSounds() {
		Object.values(this.sounds).forEach(sound => {
			sound.pause();
			sound.currentTime = 0;
		});
	}

	// Блокує кнопки спіну
	disableSpinButtons() {
		this.spinButton.classList.add('disabled');
		this.linesItems.forEach(item => item.classList.add('locked'));
	}

	// Розблоковує кнопки спіну
	enableSpinButtons() {
		// Не розблоковуємо якщо всі спіни використано
		const results = this.getResultsForCurrentBreakpoint();
		if (this.spinCount >= results.length) return;

		this.spinButton.classList.remove('disabled');
		this.linesItems.forEach(item => item.classList.remove('locked'));
	}

	// Збільшення ставки
	increaseBet() {
		if (this.isSpinning) return;

		const newBet = Math.round((this.bet + this.betStep) * 100) / 100;
		if (newBet <= this.maxBet) {
			this.bet = newBet;
			this.updateUI();
		}
	}

	// Зменшення ставки
	decreaseBet() {
		if (this.isSpinning) return;

		const newBet = Math.round((this.bet - this.betStep) * 100) / 100;
		if (newBet >= this.minBet) {
			this.bet = newBet;
			this.updateUI();
		}
	}

	// Оновлення UI
	updateUI() {
		if (this.balanceElement) {
			this.balanceElement.textContent = this.currency + this.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}
		if (this.betElement) {
			this.betElement.textContent = this.currency + this.bet.toFixed(2);
		}
	}

	// Генерує випадкові лінії для поточного брейкпоінта
	generateRandomLines(count) {
		const lines = [];
		const rows = this.config.rows;
		const cols = this.config.cols;

		for (let i = 0; i < count; i++) {
			const line = [];
			for (let col = 0; col < cols; col++) {
				line.push(Math.floor(Math.random() * rows));
			}
			lines.push(line);
		}
		return lines;
	}

	// Перегенеровує патерни ліній для поточного брейкпоінта
	regenerateLinePatterns() {
		this.linePatterns = {
			100: this.generateRandomLines(20),
			80: this.generateRandomLines(16),
			60: this.generateRandomLines(12),
			40: this.generateRandomLines(8),
			20: this.generateRandomLines(4)
		};
	}

	// Обробка кліку на Lines
	handleLinesClick(item) {
		if (item.classList.contains('locked')) return;

		// Знімаємо active з усіх
		this.linesItems.forEach(li => li.classList.remove('active'));
		// Додаємо active на поточний
		item.classList.add('active');

		this.playSound('select');

		// Отримуємо значення
		const value = parseInt(item.dataset.value);
		this.showLines(value);
	}

	// Показує лінії для вибраного значення
	showLines(value) {
		// Видаляємо попередні лінії
		this.removePaylines();

		// Скасовуємо попередній таймер зникнення
		if (this.paylinesTimeout) {
			clearTimeout(this.paylinesTimeout);
		}

		const lines = this.linePatterns[value];
		if (!lines) return;

		const iconHeight = this.getIconHeight();
		const spinnerRect = this.drumSpinner.getBoundingClientRect();
		const columns = this.drumSpinner.querySelectorAll('.drum__column');
		const swPayline = spinnerRect.width * 0.006;
		const swPaylineStroke = spinnerRect.width * 0.011;

		// Створюємо SVG контейнер
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'paylines-svg');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		svg.style.position = 'absolute';
		svg.style.top = '0';
		svg.style.left = '0';
		svg.style.pointerEvents = 'none';
		svg.style.zIndex = '40';
		svg.style.overflow = 'visible';

		// Малюємо кожну лінію
		lines.forEach((line) => {
			const points = [];

			line.forEach((rowIndex, colIndex) => {
				if (colIndex >= columns.length) return;

				const column = columns[colIndex];
				const colRect = column.getBoundingClientRect();

				const x = colRect.left - spinnerRect.left + colRect.width / 2;
				const y = (rowIndex + 0.5) * iconHeight;

				points.push({ x, y });
			});

			if (points.length < 2) return;

			const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

			// Створюємо червону обводку (нижній шар)
			const strokeLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
			strokeLine.setAttribute('points', pointsStr);
			strokeLine.setAttribute('class', 'payline-stroke');
			strokeLine.style.strokeWidth = `${swPaylineStroke}px`;
			svg.appendChild(strokeLine);

			// Створюємо золоту лінію (верхній шар)
			const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
			polyline.setAttribute('points', pointsStr);
			polyline.setAttribute('class', 'payline');
			polyline.style.strokeWidth = `${swPayline}px`;
			svg.appendChild(polyline);
		});

		this.drumSpinner.appendChild(svg);

		// Плавна поява
		this.delay(() => {
			svg.classList.add('visible');
		}, 50);

		// Автоматичне зникнення через 2 секунди
		this.paylinesTimeout = this.delay(() => {
			this.hidePaylines();
		}, 2000);
	}

	// Плавно приховує лінії
	hidePaylines() {
		const svg = this.drumSpinner.querySelector('.paylines-svg');
		if (svg) {
			svg.classList.remove('visible');
			this.delay(() => svg.remove(), 300);
		}
	}

	// Видаляє лінії paylines
	removePaylines() {
		const svg = this.drumSpinner.querySelector('.paylines-svg');
		if (svg) {
			svg.remove();
		}
	}
}

let game = null;

// Рендерить лендінг для конфігу. Викликається при завантаженні і на кожну зміну
// конфігу — правка застосовується без збірки та перезавантаження сторінки.
function mount(config) {
	game?.destroy();
	renderLanding(config);
	game = new SlotMachine(config);
	return game;
}

let devMenu = null;

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', async () => {
	const config = await loadConfig();
	mount(config);

	// Зміна public/config.json перерендерює лендінг на місці
	watchConfig(config, next => {
		mount(next);
		devMenu?.sync(next);
	});

	// Панель конфігу — потрапляє і в production (керується config.dev.menu).
	// У dev пише в public/config.json, у зібраному білді — в localStorage браузера
	// (див. docs/config.md, "The config menu"). Для dev-only варіанту:
	// `import.meta.env.DEV && config.dev.menu`.
	if (config.dev.menu) {
		const { initDevMenu, CORE_FIELDS } = await import('@js/config/devmenu.js');
		devMenu = await initDevMenu(config, next => mount(next), {
			fields: [...GAME_FIELDS, ...CORE_FIELDS],
			title: 'THE DOG HOUSE'
		});
	}
});
