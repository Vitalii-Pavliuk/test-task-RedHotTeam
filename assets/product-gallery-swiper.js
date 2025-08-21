class ProductGallerySwiper {
  constructor() {
    this.galleries = [];
    this.init();
  }

  init() {
    const run = () => this.setupGalleries();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
    document.addEventListener('shopify:section:load', (event) => {
      const sectionElement = document.getElementById(`shopify-section-${event.detail.sectionId}`);
      if (sectionElement) {
        const galleryContainer = sectionElement.querySelector('[data-swiper-gallery]');
        if (galleryContainer) {
          this.destroy(event.detail.sectionId);
          this.setupGallery(galleryContainer);
        }
      }
    });

    document.addEventListener('shopify:section:unload', (event) => {
      this.destroy(event.detail.sectionId);
    });
  }

  setupGalleries() {
    if (typeof Swiper === 'undefined') {
      setTimeout(() => this.setupGalleries(), 100);
      return;
    }
    document.querySelectorAll('[data-swiper-gallery]').forEach(container => {
      if (!container.classList.contains('swiper-initialized-by-script')) {
        container.classList.add('swiper-initialized-by-script');
        this.setupGallery(container);
      }
    });
  }

  setupGallery(container) {
    const sectionId = this.getSectionId(container);
    const productInfo = this.findProductInfo(sectionId);
    if (!productInfo) return;

    const gallery = {
      container,
      sectionId,
      productInfo,
      swiper: null,
      observer: null,
      currentColor: null,
      isFiltering: false,
      settings: this.getGallerySettings(container)
    };

    this.galleries.push(gallery);
    this.prepareSlides(gallery);
    this.initializeSwiper(gallery);
    this.setupColorFiltering(gallery);
  }

  prepareSlides(gallery) {
    const slidesContainer = gallery.container.querySelector('ul');
    if (!slidesContainer) return;
    slidesContainer.classList.add('swiper-wrapper');
    slidesContainer.querySelectorAll('li').forEach(slide => {
      slide.classList.add('swiper-slide');
    });
  }

  getSectionId(container) {
    const mediaGallery = container.closest('media-gallery');
    const shopifySection = container.closest('.shopify-section');
    return shopifySection ? shopifySection.id.replace('shopify-section-', '') : (mediaGallery?.id.replace('MediaGallery-', '') || `gallery-${Date.now()}`);
  }

  getGallerySettings(container) {
    const mediaGallery = container.closest('media-gallery');
    return {
      spaceBetween: parseInt(mediaGallery?.dataset.swiperSpaceBetween || '0'),
      enablePagination: mediaGallery?.dataset.swiperEnablePagination === 'true',
      enableNavigation: mediaGallery?.dataset.swiperEnableNavigation === 'true',
      colorIndex: parseInt(mediaGallery?.dataset.colorIndex || '-1')
    };
  }

  findProductInfo(sectionId) {
    const sectionElement = document.getElementById(`shopify-section-${sectionId}`);
    return (sectionElement && sectionElement.querySelector('product-info')) || document.querySelector(`product-info[data-section="${sectionId}"]`) || document.querySelector('product-info');
  }

  initializeSwiper(gallery) {
    const { container, settings } = gallery;
    container.classList.add('product-gallery-swiper');

    const navigation = settings.enableNavigation ? this.createNavigation(container) : false;
    const pagination = settings.enablePagination ? this.createPagination(container) : false;

    const swiperConfig = {
      slidesPerView: 1,
      spaceBetween: settings.spaceBetween,
      loop: false,
      navigation,
      pagination,
      on: {
        init: (swiper) => this.onSwiperInit(swiper, gallery),
        slideChange: (swiper) => this.onSlideChange(gallery, swiper)
      }
    };
    gallery.swiper = new Swiper(container, swiperConfig);
  }
  
  createNavigation(container) {
    if (!container.querySelector('.swiper-button-next')) {
      container.insertAdjacentHTML('beforeend', '<div class="swiper-button-next"></div><div class="swiper-button-prev"></div>');
    }
    return { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' };
  }

  createPagination(container) {
    if (!container.querySelector('.swiper-pagination')) {
      container.insertAdjacentHTML('beforeend', '<div class="swiper-pagination"></div>');
    }
    return { el: '.swiper-pagination', clickable: true };
  }

  onSwiperInit(swiper, gallery) {
    swiper.update();
    this.updateControlsVisibility(swiper, gallery.container);
    this.observeSizeChanges(gallery, swiper);
  }
  
  observeSizeChanges(gallery, swiper) {
    if (!gallery.container.parentElement) return;
    gallery.observer = new ResizeObserver(() => swiper.update());
    gallery.observer.observe(gallery.container.parentElement);
  }

  updateControlsVisibility(swiper, container) {
    const visibleSlides = swiper.slides.filter(slide => slide.style.display !== 'none');
    if (visibleSlides.length <= 1) {
      container.classList.add('swiper-single-slide');
    } else {
      container.classList.remove('swiper-single-slide');
    }
  }

  onSlideChange(gallery, swiper) {
    if (gallery.isFiltering) return;
    const activeSlide = swiper.slides[swiper.activeIndex];
    if (activeSlide) {
      const slideColor = activeSlide.dataset.variantColors;
      if (slideColor) {
        const firstColor = slideColor.split('||')[0].trim();
        if (firstColor && firstColor !== gallery.currentColor) {
          this.updateColorSelector(gallery, firstColor);
        }
      }
    }
  }

  setupColorFiltering(gallery) {
    if (gallery.settings.colorIndex < 0) return;
    gallery.productInfo.addEventListener('change', (event) => {
      if (event.target.closest('input[type="radio"], select')) {
        const color = this.getCurrentColor(gallery);
        if (color !== null && color !== gallery.currentColor) {
          this.applyColorFilter(gallery, color);
        }
      }
    });
  }

  getCurrentColor(gallery) {
    const { productInfo, settings } = gallery;
    const fieldset = productInfo.querySelectorAll('fieldset.product-form__input')[settings.colorIndex];
    if (fieldset) {
      const checkedRadio = fieldset.querySelector('input:checked');
      return checkedRadio ? checkedRadio.value.toLowerCase() : null;
    }
    const select = productInfo.querySelectorAll('select.select__select')[settings.colorIndex];
    return select ? select.value.toLowerCase() : null;
  }

  applyColorFilter(gallery, color) {
    if (!gallery.swiper) return;
    
    gallery.currentColor = color;
    gallery.isFiltering = true;
    
    const { swiper, container } = gallery;
    let firstVisibleIndex = -1;
    
    swiper.slides.forEach((slide, index) => {
      const slideColors = slide.dataset.variantColors || '';
      const isVisible = slideColors.toLowerCase().includes(color);
      slide.style.display = isVisible ? '' : 'none';
      if (isVisible && firstVisibleIndex === -1) {
        firstVisibleIndex = index;
      }
    });

    swiper.update();
    
    if (firstVisibleIndex !== -1) {
      swiper.slideTo(firstVisibleIndex, 0);
    }
    
    this.updateControlsVisibility(swiper, container);
    
    setTimeout(() => { gallery.isFiltering = false; }, 100);
  }

  updateColorSelector(gallery, color) {
    const { productInfo, settings } = gallery;
    if (settings.colorIndex < 0) return;

    gallery.currentColor = color;

    const fieldset = productInfo.querySelectorAll('fieldset.product-form__input')[settings.colorIndex];
    if (fieldset) {
      const radio = Array.from(fieldset.querySelectorAll('input[type="radio"]')).find(input => input.value.toLowerCase() === color.toLowerCase());
      if (radio && !radio.checked) {
        radio.checked = true;
      }
    } else {
      const select = productInfo.querySelectorAll('select.select__select')[settings.colorIndex];
      if (select && select.value.toLowerCase() !== color.toLowerCase()) {
        const optionToSelect = Array.from(select.options).find(option => option.value.toLowerCase() === color.toLowerCase());
        if (optionToSelect) {
          select.value = optionToSelect.value;
        }
      }
    }
  }

  destroy(sectionId) {
    const galleryIndex = this.galleries.findIndex(g => g.sectionId.includes(sectionId));
    if (galleryIndex > -1) {
      const gallery = this.galleries[galleryIndex];
      gallery.swiper?.destroy(true, true);
      gallery.observer?.disconnect();
      this.galleries.splice(galleryIndex, 1);
    }
  }
}

if (!window.ProductGallerySwiper) {
  window.ProductGallerySwiper = new ProductGallerySwiper();
}