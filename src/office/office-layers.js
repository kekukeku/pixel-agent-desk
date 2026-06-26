/**
 * Office Layers — Background/foreground image loading
 * Ported from pixel_office layerCache.ts
 */

/* eslint-disable no-unused-vars */

function loadOfficeImage(src) {
  return new Promise(function (resolve) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () {
      console.warn('[OfficeLayers] Failed to load:', src);
      const blank = new Image();
      blank.width = 800;
      blank.height = 800;
      resolve(blank);
    };
    img.src = src;
  });
}

var officeLayers = {
  bgImage: null,
  fgImage: null,
  mapFolder: 'map',
  width: 0,
  height: 0,
};

async function buildOfficeLayers() {
  const ts = Date.now();
  const mapFolder = localStorage.getItem('officeMapFolder') || 'map';
  const bgImgName = 'office_bg_32.webp';

  const bgImg = await loadOfficeImage(`/public/office/${mapFolder}/${bgImgName}?t=` + ts);
  const fgImg = await loadOfficeImage(`/public/office/${mapFolder}/office_fg_32.webp?t=` + ts);

  officeLayers.bgImage = bgImg;
  officeLayers.fgImage = fgImg;
  officeLayers.mapFolder = mapFolder;
  officeLayers.width = bgImg.naturalWidth || 800;
  officeLayers.height = bgImg.naturalHeight || 800;

  return officeLayers;
}
