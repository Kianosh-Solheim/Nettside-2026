import sharp from 'sharp';

async function run() {
  await sharp('public/regular-mouse.png')
    .resize({ width: 43 })
    .toFile('public/regular-mouse-43.png');
  
  await sharp('public/click-mouse.png')
    .resize({ width: 43 })
    .toFile('public/click-mouse-43.png');
}

run();
