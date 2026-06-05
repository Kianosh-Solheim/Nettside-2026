import sharp from 'sharp';

async function run() {
  await sharp('public/regular-mouse.png')
    .resize({ width: 48 })
    .toFile('public/regular-mouse-48.png');
  
  await sharp('public/click-mouse.png')
    .resize({ width: 48 })
    .toFile('public/click-mouse-48.png');
}

run();
