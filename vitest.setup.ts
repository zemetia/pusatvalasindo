import '@testing-library/jest-dom';

// jsdom tidak punya ResizeObserver. cmdk (dasar `ui/combobox`) memanggilnya
// saat mount, jadi tanpa boneka ini setiap test yang membuka Combobox gagal
// dengan "ResizeObserver is not defined" — bukan karena komponennya salah.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Sama sebabnya: jsdom tidak melakukan layout, jadi API di bawah ini tidak
// ada sama sekali. cmdk menggulirkan opsi terpilih ke tampilan, dan Radix
// (Popover/Select) memakai pointer capture — keduanya dipanggil saat mount,
// jauh sebelum test sempat menegaskan apa pun.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
