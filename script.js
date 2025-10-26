const heroCardData = {
  name: "Альхимический навигатор",
  description:
    "Уникальная карта героя с интеллектуальным кристаллом — ведёт отряд через штормы и раскрывает скрытые тропы в одно касание.",
  price: "12 500 ₽",
  features: [
    "Голографический интерфейс с жестовым управлением",
    "Ускоренный заряд в док-станции за 12 минут",
    "Синхронизация с экипировкой через эфирный канал",
  ],
  image:
    "https://images.unsplash.com/photo-1517814777516-0bc0e7c098c7?auto=format&fit=crop&w=720&h=1080&q=80",
  imageAlt: "Навигатор в руках исследовательницы",
};

const cardsData = [
  {
    name: "Комплект эфирных перчаток",
    price: "2 450 ₽",
    image:
      "https://images.unsplash.com/photo-1556909212-d5b604d0c21b?auto=format&fit=crop&w=600&h=900&q=80",
    imageAlt: "Светящиеся перчатки на столе",
  },
  {
    name: "Полевой радар 'Кристалл'",
    price: "1 180 ₽",
    image:
      "https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=1080&h=720&q=80",
    imageAlt: "Портативный радар на ремне",
    strategy: "css",
  },
  {
    name: "Модуль 'Северное сияние'",
    price: "990 ₽",
    image:
      "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1080&h=720&q=80",
    imageAlt: "Легкая панель из карбона",
    strategy: "canvas",
  },
  {
    name: "Умный герметичный плед",
    price: "1 560 ₽",
    image:
      "https://images.unsplash.com/photo-1512485800893-b08ec1ea29af?auto=format&fit=crop&w=600&h=900&q=80",
    imageAlt: "Плед с геометрическим узором",
  },
  {
    name: "Инженерный планшет",
    price: "3 750 ₽",
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1080&h=720&q=80",
    imageAlt: "Планшет с чертежами",
    strategy: "canvas",
  },
  {
    name: "Сплавной аркан",
    price: "860 ₽",
    image:
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=600&h=900&q=80",
    imageAlt: "Верёвка из сплава",
  },
  {
    name: "Многофункциональный проектор",
    price: "4 100 ₽",
    image:
      "https://images.unsplash.com/photo-1527430253228-e93688616381?auto=format&fit=crop&w=1080&h=720&q=80",
    imageAlt: "Проектор на столе",
    strategy: "css",
  },
];

function renderHeroCard(root, data) {
  if (!root) return;
  const preview = root.querySelector('[data-role="preview"]');
  const img = preview?.querySelector('img');
  const name = root.querySelector('[data-role="name"]');
  const description = root.querySelector('[data-role="description"]');
  const features = root.querySelector('[data-role="features"]');
  const price = root.querySelector('[data-role="price"]');

  if (img) {
    img.src = data.image;
    img.alt = data.imageAlt || data.name;
    img.decoding = 'async';
  }

  if (name) {
    name.textContent = data.name;
  }

  if (description) {
    description.textContent = data.description;
  }

  if (Array.isArray(data.features) && features) {
    features.innerHTML = '';
    for (const feature of data.features) {
      const li = document.createElement('li');
      li.textContent = feature;
      features.appendChild(li);
    }
  }

  if (price) {
    price.textContent = data.price;
  }
}

function createItemCard(item) {
  const card = document.createElement('article');
  card.className = 'item-card';

  const preview = document.createElement('div');
  preview.className = 'card-preview';

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = item.image;
  img.alt = item.imageAlt || item.name;
  preview.appendChild(img);

  const meta = document.createElement('div');
  meta.className = 'item-card__meta';

  const name = document.createElement('span');
  name.className = 'item-card__name';
  name.textContent = item.name;

  const divider = document.createElement('span');
  divider.textContent = '|';
  divider.setAttribute('aria-hidden', 'true');

  const price = document.createElement('span');
  price.className = 'item-card__price';
  price.textContent = item.price;

  meta.append(name, divider, price);

  const actions = document.createElement('div');
  actions.className = 'item-card__actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.type = 'button';
  addBtn.textContent = 'В корзину';

  const moreBtn = document.createElement('button');
  moreBtn.className = 'btn btn--ghost';
  moreBtn.type = 'button';
  moreBtn.textContent = 'Подробнее';

  actions.append(addBtn, moreBtn);

  card.append(preview, meta, actions);

  applyLandscapeStrategy(preview, img, item.strategy);

  return card;
}

function applyLandscapeStrategy(previewEl, imgEl, strategy) {
  if (!strategy) {
    return;
  }

  if (strategy === 'css') {
    previewEl.classList.add('card-preview--rotate');
    return;
  }

  if (strategy === 'canvas') {
    const convert = () => {
      const dataUrl = toPortraitDataUrl(imgEl);
      if (dataUrl) {
        imgEl.src = dataUrl;
        imgEl.dataset.portrait = 'true';
      }
    };

    if (imgEl.complete && imgEl.naturalWidth && imgEl.naturalHeight) {
      convert();
    } else {
      imgEl.addEventListener('load', convert, { once: true });
    }
  }
}

function toPortraitDataUrl(imageEl) {
  if (!imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = imageEl.naturalHeight;
  canvas.height = imageEl.naturalWidth;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(
    imageEl,
    -imageEl.naturalWidth / 2,
    -imageEl.naturalHeight / 2,
    imageEl.naturalWidth,
    imageEl.naturalHeight
  );

  return canvas.toDataURL('image/jpeg', 0.92);
}

function renderCardsGrid(root, items) {
  if (!root) return;
  root.innerHTML = '';
  for (const item of items) {
    root.appendChild(createItemCard(item));
  }
}

renderHeroCard(document.getElementById('heroCard'), heroCardData);
renderCardsGrid(document.getElementById('cardsGrid'), cardsData);

// Экспорт функции в глобальную область для демонстрационных целей.
window.toPortraitDataUrl = toPortraitDataUrl;
