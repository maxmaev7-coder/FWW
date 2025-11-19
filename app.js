// Ждём картинок, иначе браузер может распечатать пустые/смазанные блоки
function waitForImages(root = document){
  const imgs = Array.from(root.querySelectorAll('img'));
  const pending = imgs
    .filter(img => !img.complete || img.naturalWidth === 0)
    .map(img => new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }));
  return Promise.all(pending);
}

async function handlePrint(){
  document.documentElement.classList.add('print-mode');
  await waitForImages();     // дождаться
  window.print();
  // На некоторых движках лучше вернуть класс обратно через тик
  setTimeout(() => {
    document.documentElement.classList.remove('print-mode');
  }, 100);
}

document.getElementById('printBtn')?.addEventListener('click', handlePrint);
