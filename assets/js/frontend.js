(function(window, $) {
    /**
     * Yfetch pro info message
     */
    if (typeof jQuery === 'undefined') throw new Error('Yfetch pro\'s JavaScript requires jQuery')

    var uriAttrs = ['background', 'cite', 'href', 'itemtype', 'longdesc', 'poster', 'src', 'xlink:href']

    var ARIA_ATTRIBUTE_PATTERN = /^aria-[\w-]*$/i

    var DefaultWhitelist = {
        '*': ['class', 'dir', 'id', 'lang', 'role', ARIA_ATTRIBUTE_PATTERN],
        a: ['target', 'href', 'title', 'rel'],
        area: [],
        b: [],
        br: [],
        col: [],
        code: [],
        div: [],
        em: [],
        hr: [],
        h1: [],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
        i: [],
        img: ['src', 'alt', 'title', 'width', 'height', 'data-lazy-src'],
        li: [],
        ol: [],
        p: [],
        pre: [],
        s: [],
        small: [],
        span: [],
        sub: [],
        sup: [],
        strong: [],
        u: [],
        ul: []
    }

    var SAFE_URL_PATTERN = /^(?:(?:https?|mailto|ftp|tel|file):|[^&:/?#]*(?:[/?#]|$))/gi

    var DATA_URL_PATTERN = /^data:(?:image\/(?:bmp|gif|jpeg|jpg|png|tiff|webp)|video\/(?:mpeg|mp4|ogg|webm)|audio\/(?:mp3|oga|ogg|opus));base64,[a-z0-9+/]+=*$/i

    function allowedAttribute(attr, allowedAttributeList) {
        var attrName = attr.nodeName.toLowerCase()

        if ($.inArray(attrName, allowedAttributeList) !== -1) {
            if ($.inArray(attrName, uriAttrs) !== -1) {
                return Boolean(attr.nodeValue.match(SAFE_URL_PATTERN) || attr.nodeValue.match(DATA_URL_PATTERN))
            }

            return true
        }

        var regExp = $(allowedAttributeList).filter(function(index, value) {
            return value instanceof RegExp
        })

        for (var i = 0, l = regExp.length; i < l; i++) {
            if (attrName.match(regExp[i])) {
                return true
            }
        }

        return false
    }

    function sanitizeHtml(unsafeHtml) {
        if (unsafeHtml.length === 0) {
            return unsafeHtml
        }

        if (!document.implementation || !document.implementation.createHTMLDocument) {
            return unsafeHtml
        }

        var whiteList = DefaultWhitelist
        var createdDocument = document.implementation.createHTMLDocument('sanitization')
        createdDocument.body.innerHTML = unsafeHtml

        var whitelistKeys = $.map(whiteList, function(el, i) {
            return i
        })
        var elements = $(createdDocument.body).find('*')

        for (var i = 0, len = elements.length; i < len; i++) {
            var el = elements[i]
            var elName = el.nodeName.toLowerCase()

            if ($.inArray(elName, whitelistKeys) === -1) {
                el.parentNode.removeChild(el)

                continue
            }

            var attributeList = $.map(el.attributes, function(el) {
                return el
            })
            var whitelistedAttributes = [].concat(whiteList['*'] || [], whiteList[elName] || [])

            for (var j = 0, len2 = attributeList.length; j < len2; j++) {
                if (!allowedAttribute(attributeList[j], whitelistedAttributes)) {
                    el.removeAttribute(attributeList[j].nodeName)
                }
            }
        }

        return createdDocument.body.innerHTML
    }

    var Yfetch_info = function(element, options) {
        this.type = null
        this.options = null
        this.enabled = null
        this.timeout = null
        this.hoverState = null
        this.$element = null
        this.inState = null

        this.init('yfinfo', element, options)
    }

    Yfetch_info.TRANSITION_DURATION = 150

    Yfetch_info.DEFAULTS = {
        animation: true,
        placement: 'top',
        delay: 0,
        viewport: {
            selector: 'body',
            padding: 0
        }
    }

    Yfetch_info.prototype.init = function(type, element, options) {
        this.enabled = true
        this.type = type
        this.$element = $(element)
        this.options = this.getOptions(options)
        this.$viewport = this.options.viewport && $(document).find($.isFunction(this.options.viewport) ? this.options.viewport.call(this, this.$element) : (this.options.viewport.selector || this.options.viewport))
        this.inState = {
            click: false,
            hover: false,
            focus: false
        }

        if (this.$element[0] instanceof document.constructor) {
            throw new Error('`selector` option must be specified when initializing ' + this.type + ' on the window.document object!')
        }

        this.$element.on('click.' + this.type, false, $.proxy(this.toggle, this))
    }

    Yfetch_info.prototype.getDefaults = function() {
        return Yfetch_info.DEFAULTS
    }

    Yfetch_info.prototype.getOptions = function(options) {
        var dataAttributes = this.$element.data()

        options = $.extend({}, this.getDefaults(), dataAttributes, options)

        if (options.delay && typeof options.delay == 'number') {
            options.delay = {
                show: options.delay,
                hide: options.delay
            }
        }

        return options
    }

    Yfetch_info.prototype.getDelegateOptions = function() {
        var options = {}
        var defaults = this.getDefaults()

        this._options && $.each(this._options, function(key, value) {
            if (defaults[key] != value) options[key] = value
        })

        return options
    }

    Yfetch_info.prototype.enter = function(obj) {
        var self = obj instanceof this.constructor ?
            obj : $(obj.currentTarget).data('bs.' + this.type)

        if (!self) {
            self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
            $(obj.currentTarget).data('bs.' + this.type, self)
        }

        if (obj instanceof $.Event) {
            self.inState[obj.type == 'focusin' ? 'focus' : 'hover'] = true
        }

        if (self.tip().hasClass('in') || self.hoverState == 'in') {
            self.hoverState = 'in'
            return
        }

        clearTimeout(self.timeout)

        self.hoverState = 'in'

        if (!self.options.delay || !self.options.delay.show) return self.show()

        self.timeout = setTimeout(function() {
            if (self.hoverState == 'in') self.show()
        }, self.options.delay.show)
    }

    Yfetch_info.prototype.isInStateTrue = function() {
        for (var key in this.inState) {
            if (this.inState[key]) return true
        }

        return false
    }

    Yfetch_info.prototype.leave = function(obj) {
        var self = obj instanceof this.constructor ?
            obj : $(obj.currentTarget).data('bs.' + this.type)

        if (!self) {
            self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
            $(obj.currentTarget).data('bs.' + this.type, self)
        }

        if (obj instanceof $.Event) {
            self.inState[obj.type == 'focusout' ? 'focus' : 'hover'] = false
        }

        if (self.isInStateTrue()) return

        clearTimeout(self.timeout)

        self.hoverState = 'out'

        if (!self.options.delay || !self.options.delay.hide) return self.hide()

        self.timeout = setTimeout(function() {
            if (self.hoverState == 'out') self.hide()
        }, self.options.delay.hide)
    }

    Yfetch_info.prototype.show = function() {
        var e = $.Event('show.bs.' + this.type)

        if (this.hasContent() && this.enabled) {
            this.$element.trigger(e)

            var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])
            if (e.isDefaultPrevented() || !inDom) return
            var that = this

            var $tip = this.tip()

            var tipId = this.getUID(this.type)

            this.setContent()
            $tip.attr('id', tipId)
            this.$element.attr('aria-describedby', tipId)

            if (this.options.animation) $tip.addClass('fade')

            var placement = typeof this.options.placement == 'function' ?
                this.options.placement.call(this, $tip[0], this.$element[0]) :
                this.options.placement

            var autoToken = /\s?auto?\s?/i
            var autoPlace = autoToken.test(placement)
            if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

            $tip
                .detach()
                .css({
                    top: 0,
                    left: 0,
                    display: 'block'
                })
                .addClass(placement)
                .data('bs.' + this.type, this)

            $tip.insertAfter(this.$element)

            this.$element.trigger('inserted.bs.' + this.type)

            var pos = this.getPosition()
            var actualWidth = $tip[0].offsetWidth
            var actualHeight = $tip[0].offsetHeight

            if (autoPlace) {
                var orgPlacement = placement
                var viewportDim = this.getPosition(this.$viewport)

                placement = placement == 'bottom' && pos.bottom + actualHeight > viewportDim.bottom ? 'top' :
                    placement == 'top' && pos.top - actualHeight < viewportDim.top ? 'bottom' :
                    placement == 'right' && pos.right + actualWidth > viewportDim.width ? 'left' :
                    placement == 'left' && pos.left - actualWidth < viewportDim.left ? 'right' :
                    placement

                $tip
                    .removeClass(orgPlacement)
                    .addClass(placement)
            }

            var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

            this.applyPlacement(calculatedOffset, placement)

            var complete = function() {
                var prevHoverState = that.hoverState
                that.$element.trigger('shown.bs.' + that.type)
                that.hoverState = null

                if (prevHoverState == 'out') that.leave(that)
            }

            $.support.transition && this.$tip.hasClass('fade') ?
                $tip
                .one('bsTransitionEnd', complete)
                .emulateTransitionEnd(Yfetch_info.TRANSITION_DURATION) :
                complete()
        }
    }

    Yfetch_info.prototype.applyPlacement = function(offset, placement) {
        var $tip = this.tip()
        var width = $tip[0].offsetWidth
        var height = $tip[0].offsetHeight
        var marginTop = parseInt($tip.css('margin-top'), 10)
        var marginLeft = parseInt($tip.css('margin-left'), 10)

        if (isNaN(marginTop)) marginTop = 0
        if (isNaN(marginLeft)) marginLeft = 0

        offset.top += marginTop
        offset.left += marginLeft

        $.offset.setOffset($tip[0], $.extend({
            using: function(props) {
                $tip.css({
                    top: Math.round(props.top),
                    left: Math.round(props.left)
                })
            }
        }, offset), 0)

        $tip.addClass('in')

        var actualWidth = $tip[0].offsetWidth
        var actualHeight = $tip[0].offsetHeight

        if (placement == 'top' && actualHeight != height) {
            offset.top = offset.top + height - actualHeight
        }

        var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

        if (delta.left) offset.left += delta.left
        else offset.top += delta.top

        var isVertical = /top|bottom/.test(placement)
        var arrowDelta = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
        var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'

        $tip.offset(offset)
        this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)
    }

    Yfetch_info.prototype.replaceArrow = function(delta, dimension, isVertical) {
        this.arrow()
            .css(isVertical ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')
            .css(isVertical ? 'top' : 'left', '')
    }

    Yfetch_info.prototype.setContent = function() {
        var $tip = this.tip();
        var content = this.getContent();

        content = sanitizeHtml(content);

        $tip.find('.yfinfo-inner').html('<div class="social_window">'+content+'</div>');

        $tip.find('.yfinfo-inner img').each(function(i, element) {
            var imgsrc = $(element).attr("data-lazy-src");
            if ( ! isEmpty(imgsrc) ) {
                $(element).prop("src", imgsrc);
            }
        });
       
        $tip.removeClass('fade in top bottom left right')
    }

    Yfetch_info.prototype.hide = function(callback) {
        var that = this
        var $tip = $(this.$tip)
        var e = $.Event('hide.bs.' + this.type)

        function complete() {
            if (that.hoverState != 'in') $tip.detach()
            if (that.$element) {
                that.$element
                    .removeAttr('aria-describedby')
                    .trigger('hidden.bs.' + that.type)
            }
            callback && callback()
        }

        this.$element.trigger(e)

        if (e.isDefaultPrevented()) return

        $tip.removeClass('in')

        $.support.transition && $tip.hasClass('fade') ?
            $tip
            .one('bsTransitionEnd', complete)
            .emulateTransitionEnd(Yfetch_info.TRANSITION_DURATION) :
            complete()

        this.hoverState = null

        return this
    }

    Yfetch_info.prototype.hasContent = function() {
        return this.getContent()
    }

    Yfetch_info.prototype.getPosition = function($element) {
        $element = $element || this.$element

        var el = $element[0]
        var isBody = el.tagName == 'BODY'

        var elRect = el.getBoundingClientRect()
        if (elRect.width == null) {
            elRect = $.extend({}, elRect, {
                width: elRect.right - elRect.left,
                height: elRect.bottom - elRect.top
            })
        }
        var isSvg = window.SVGElement && el instanceof window.SVGElement
        var elOffset = isBody ? {
            top: 0,
            left: 0
        } : (isSvg ? null : $element.offset())
        var scroll = {
            scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop()
        }
        var outerDims = isBody ? {
            width: $(window).width(),
            height: $(window).height()
        } : null

        return $.extend({}, elRect, scroll, outerDims, elOffset)
    }

    Yfetch_info.prototype.getCalculatedOffset = function(placement, pos, actualWidth, actualHeight) {
        return placement == 'bottom' ? {
            top: pos.top + pos.height,
            left: pos.left + pos.width / 2 - actualWidth / 2
        } :
        placement == 'top' ? {
            top: pos.top - actualHeight,
            left: pos.left + pos.width / 2 - actualWidth / 2
        } :
        placement == 'left' ? {
            top: pos.top + pos.height / 2 - actualHeight / 2,
            left: pos.left - actualWidth
        } :
        {
            top: pos.top + pos.height / 2 - actualHeight / 2,
            left: pos.left + pos.width
        }
    }

    Yfetch_info.prototype.getViewportAdjustedDelta = function(placement, pos, actualWidth, actualHeight) {
        var delta = {top: 0, left: 0}
        if (!this.$viewport) return delta

        var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
        var viewportDimensions = this.getPosition(this.$viewport)

        if (/right|left/.test(placement)) {
            var topEdgeOffset = pos.top - viewportPadding - viewportDimensions.scroll
            var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
            if (topEdgeOffset < viewportDimensions.top) {
                delta.top = viewportDimensions.top - topEdgeOffset
            } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) {
                delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
            }
        } else {
            var leftEdgeOffset = pos.left - viewportPadding
            var rightEdgeOffset = pos.left + viewportPadding + actualWidth
            if (leftEdgeOffset < viewportDimensions.left) {
                delta.left = viewportDimensions.left - leftEdgeOffset
            } else if (rightEdgeOffset > viewportDimensions.right) {
                delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
            }
        }

        return delta
    }

    Yfetch_info.prototype.getContent = function() {
        var $e = this.$element
        var o = this.options

        if ( $e.attr('data-target') ) {
            var div = $e.attr('data-target')
            return $e.parent().find(div).html()
        } else {
            return $e.html()
        }
    }

    Yfetch_info.prototype.getUID = function(prefix) {
        do prefix += ~~(Math.random() * 1000000)
        while (document.getElementById(prefix))
        return prefix
    }

    Yfetch_info.prototype.tip = function() {
        if (!this.$tip) {
            var template = '<div class="yfinfo" role="yfinfo"><div class="yfinfo-arrow"></div><div class="yfinfo-inner"></div></div>'
            this.$tip = $(sanitizeHtml(template))
            if (this.$tip.length != 1) {
                throw new Error(this.type + ' `template` option must consist of exactly 1 top-level element!')
            }
        }
        return this.$tip
    }

    Yfetch_info.prototype.arrow = function() {
        return (this.$arrow = this.$arrow || this.tip().find('.yfinfo-arrow'))
    }

    Yfetch_info.prototype.enable = function() {
        this.enabled = true
    }

    Yfetch_info.prototype.disable = function() {
        this.enabled = false
    }

    Yfetch_info.prototype.toggleEnabled = function() {
        this.enabled = !this.enabled
    }

    Yfetch_info.prototype.toggle = function(e) {
        var self = this
        if (e) {
            self = $(e.currentTarget).data('bs.' + this.type)
            if (!self) {
                self = new this.constructor(e.currentTarget, this.getDelegateOptions())
                $(e.currentTarget).data('bs.' + this.type, self)
            }
        }

        if (e) {
            self.inState.click = !self.inState.click
            if (self.isInStateTrue()) self.enter(self)
            else self.leave(self)
        } else {
            self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
        }
    }

    Yfetch_info.prototype.destroy = function() {
        var that = this
        clearTimeout(this.timeout)
        this.hide(function() {
            that.$element.off('.' + that.type).removeData('bs.' + that.type)
            if (that.$tip) {
                that.$tip.detach()
            }
            that.$tip = null
            that.$arrow = null
            that.$viewport = null
            that.$element = null
        })
    }

    Yfetch_info.prototype.sanitizeHtml = function(unsafeHtml) {
        return sanitizeHtml(unsafeHtml)
    }

    function Plugin(option) {
        return this.each(function() {
            var $this = $(this)
            var data = $this.data('bs.yfinfo')
            var options = typeof option == 'object' && option

            if (!data && /destroy|hide/.test(option)) return
            if (!data) $this.data('bs.yfinfo', (data = new Yfetch_info(this, options)))
            if (typeof option == 'string') data[option]()
        })
    }

    var old = $.fn.yfinfo

    $.fn.yfinfo = Plugin
    $.fn.yfinfo.Constructor = Yfetch_info

    $.fn.yfinfo.noConflict = function() {
        $.fn.yfinfo = old
        return this
    }

    $.fn.emptyContent = function() {
        return !$.trim(this.html()).length;
    };

    var isEmpty = function(data) {
        if (typeof(data) === 'object'){
            if (JSON.stringify(data) === '{}' || JSON.stringify(data) === '[]') {
                return true;
            } else if(!data) {
                return true;
            }
            return false;
        } else if(typeof(data) === 'string') {
            if (!data.trim()) {
                return true;
            }
            return false;
        } else if(typeof(data) === 'undefined') {
            return true;
        } else {
            return false;
        }
    }

    var loadView = function(channelid, playlistid, parent, element) {
        $.ajax({
            url: yfetch.ajax_url,
            type: 'POST',
            data: {
                action: 'yfetch_load_playlist',
                channelid: channelid,
                playlistid: playlistid
            },
            beforeSend: function() {
                $(parent).addClass("disabled");
                $(element).closest(".yf_view_pagi").find(".yf_view_btn").addClass("disabled");
                $(element).attr("disabled", true);
            },
            success: function(output) {
                $(parent).html(output).show();
                $(parent).removeClass("disabled");

                var $container = $(parent).find(".epyt-gallery");
                if (!$container.emptyContent() && !$container.data('epytevents') || !$('body').hasClass('block-editor-page')) {
                    $container.data('epytevents', '1');
                    var $iframe = $container.find('iframe, div.__youtube_prefs_gdpr__').first();
                    var contentlbid = 'content' + $iframe.attr('id');
                    $container.find('.lity-hide').attr('id', contentlbid);
                    var initSrc = $iframe.data('src') || $iframe.attr('src');
                    if (!initSrc) {
                        initSrc = $iframe.data('ep-src');
                    }
                    var firstId = $container.find('.epyt-gallery-list .epyt-gallery-thumb').first().data('videoid');
                    if (typeof (initSrc) !== 'undefined') {
                        initSrc = initSrc.replace(firstId, 'GALLERYVIDEOID');
                        $container.data('ep-gallerysrc', initSrc);
                    } 
                    else if ($iframe.hasClass('__youtube_prefs_gdpr__')) {
                        $container.data('ep-gallerysrc', '');
                    }
                    var $listgallery = $container.find('.epyt-gallery-list');
                    var pagenumsalign = function () {
                        try {
                            if ($listgallery.hasClass('epyt-gallery-style-carousel')) {
                                var thumbheight = $($listgallery.find('.epyt-gallery-thumb').get(0)).height();
                                var topval = thumbheight / 2;
                                var $pagenums = $listgallery.find('.epyt-pagination:first-child .epyt-pagenumbers');
                                $pagenums.css('top', (topval + 15) + "px");
                            }
                        }
                        catch (e) { }
                    };
                    setTimeout(function () {
                        pagenumsalign();
                    }, 300);
                    $(window).resize(pagenumsalign);
                }
            }
        });
    }

    $(document).ready(function() {
        /*
        * Related table
        */
        const loader = '<div class="yf_loader"><span>🚀</span><span>Airbiip</span><span>🏃</span><span>LOADING</span></div>';
        const childItem = '<div class="yf_child_item"><div class="yf_faq_section" style="display:none"></div><div class="yf_desc_section" style="display:none"></div><div class="yf_view_section" style="display:none"></div></div>';
                    
        function nl2br (str, is_xhtml) {   
            var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';    
            return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag +'$2');
        }

        function modal_dialog(title = "", body = "") {
            title = (title != "") ? title : yfetch.title ;
            body = (body != "") ? body : '<div class="yf_modal_text">'+yfetch.body+'</div>' ;
            var output = '<div class="yf_modal_area"><div class="yf_modal"><div class="yf_modal_content">' 
            + '<div class="yf_modal_header"><h5 class="yf_modal_title" title="'+yfetch.close+'">'+title+'</h5>' 
            + '<button type="button" class="yf_modal_close">×</button>' 
            + '</div>' 
            + '<div class="yf_modal_body">'+body+'</div>' 
            + '</div>' 
            + '</div></div>';
            return output;
        }

        $('.yf-table').each(function(i, element) {
            var table = $(element).DataTable({
                "language": {
                    "lengthMenu": "Display _MENU_",
                },
                "stripeClasses": [],
                "responsive": false,
                "ordering": true,
                "pageLength": 50,
                "order": [[0, 'asc']],
                'aoColumnDefs': [{
                    "sClass": "hide_on_mobile",
                    "aTargets": [4]
                }],
            });

            // faq
            $(element).on('click', 'td .link .yf_faq', function (e) {
                e.preventDefault();
                var $this = $(this);
                if ( ! $("body").hasClass("yf_modal_active") ) {
                    $("body").addClass("yf_modal_active");
                }
                var tr = $this.closest('tr');
                var row = table.row(tr);
                if ( ! tr.hasClass("loaded") ) {
                    row.child(childItem).show();
                    tr.addClass('loaded');
                }
                var children = tr.next('tr:not(.yf_tr)');
                if ( $(children).find(".yf_faq_section").emptyContent() ) {
                    $(children).find(".yf_faq_section").html(modal_dialog(yfetch.faqs)).show();

                    var faqs = $this.attr("data-faqs");
                    faqs = (faqs != "") ? faqs.split(',') : [] ;
                    if ( faqs.length > 0 ) {
                        $.ajax({
                            url: yfetch.ajax_url,
                            type: 'POST',
                            data: {
                                action: 'yfetch_load_faq',
                                faqs: JSON.stringify(faqs)
                            },
                            beforeSend: function() {
                                $(children).find(".yf_faq_section .yf_modal_body").html('<div class="yf_load_modal">'+loader+'</div>');
                            },
                            success: function(output) {
                                $(children).find(".yf_faq_section .yf_modal_body").html(output);
                            }
                        });
                    }
                } else {
                    $(children).find(".yf_faq_section").show();
                }
            });

            // Description and instruction
            $(element).on('click', 'td .link .yf_desc', function (e) {
                e.preventDefault();
                var $this = $(this);
                if ( ! $("body").hasClass("yf_modal_active") ) {
                    $("body").addClass("yf_modal_active");
                }
                var tr = $this.closest('tr');
                var row = table.row(tr);
                if ( ! tr.hasClass("loaded") ) {
                    row.child(childItem).show();
                    tr.addClass('loaded');
                }
                var children = tr.next('tr:not(.yf_tr)');
                
                if ( $(children).find(".yf_desc_section").emptyContent() ) {
                    var desc = $this.attr("data-desc");
                    $(children).find(".yf_desc_section").html(modal_dialog(yfetch.description, '<div class="yf_load_modal">'+loader+'</div>')).show();
                    setTimeout(function() {
                        $(children).find(".yf_desc_section .yf_modal_body").html('<div class="yf_modal_text">'+nl2br(desc)+'</div>');
                    }, 700);
                } else {
                    $(children).find(".yf_desc_section").show();
                }
            });

            // Playlist
            $(element).on('click', 'td .link .yf_view', function (e) {
                e.preventDefault();
                var $this = $(this);
                var tr = $this.closest('tr');
                var row = table.row(tr);
                if ( ! tr.hasClass("loaded") ) {
                    row.child(childItem).show();
                    tr.addClass('loaded');
                }
                var children = tr.next('tr:not(.yf_tr)');
                if ( $this.hasClass("visible") ) {
                    $(children).find(".yf_view_section").hide();
                    $this.removeClass("visible");
                } else {
                    $this.closest("tbody").children("tr").not(tr).find(".yf_view_section").hide();
                    $this.closest("tbody").children("tr").not(tr).find(".yf_load.yf_view").removeClass("visible");
                    //$(window).scrollTop( tr.offset().top );
                    if ( $(children).find(".yf_view_section").emptyContent() ) {
                        $(children).find(".yf_view_section").html('<div class="yf_load_view">'+loader+'</div>').show();
                        var id = $this.attr("data-id");
                        if ( id.length > 0 ) {
                            $.ajax({
                                url: yfetch.ajax_url,
                                type: 'POST',
                                data: {
                                    action: 'yfetch_load_playlist',
                                    channelid: id
                                },
                                success: function(output) {
                                    $(children).find(".yf_view_section").html(output).show();

                                    var $container = $(children).find(".yf_view_section .epyt-gallery");
                                    if (!$container.emptyContent() && !$container.data('epytevents') || !$('body').hasClass('block-editor-page')) {
                                        $container.data('epytevents', '1');
                                        var $iframe = $container.find('iframe, div.__youtube_prefs_gdpr__').first();
                                        var contentlbid = 'content' + $iframe.attr('id');
                                        $container.find('.lity-hide').attr('id', contentlbid);
                                        var initSrc = $iframe.data('src') || $iframe.attr('src');
                                        if (!initSrc) {
                                            initSrc = $iframe.data('ep-src');
                                        }
                                        var firstId = $container.find('.epyt-gallery-list .epyt-gallery-thumb').first().data('videoid');
                                        if (typeof (initSrc) !== 'undefined') {
                                            initSrc = initSrc.replace(firstId, 'GALLERYVIDEOID');
                                            $container.data('ep-gallerysrc', initSrc);
                                        } 
                                        else if ($iframe.hasClass('__youtube_prefs_gdpr__')) {
                                            $container.data('ep-gallerysrc', '');
                                        }
                                        var $listgallery = $container.find('.epyt-gallery-list');
                                        var pagenumsalign = function () {
                                            try {
                                                if ($listgallery.hasClass('epyt-gallery-style-carousel')) {
                                                    var thumbheight = $($listgallery.find('.epyt-gallery-thumb').get(0)).height();
                                                    var topval = thumbheight / 2;
                                                    var $pagenums = $listgallery.find('.epyt-pagination:first-child .epyt-pagenumbers');
                                                    $pagenums.css('top', (topval + 15) + "px");
                                                }
                                            }
                                            catch (e) { }
                                        };
                                        setTimeout(function () {
                                            pagenumsalign();
                                        }, 300);
                                        $(window).resize(pagenumsalign);
                                    }
                                }
                            });
                        } else {
                            $(children).find(".yf_view_section").html('<p class="yf_no_view">'+yfetch.body+'</p>');
                        }
                    } else {
                        $(children).find(".yf_view_section").show();
                    }
                    $this.addClass("visible");
                }
            });
        });
        
        /*
        * Close faq & description modal
        */
        $(document).on("click", ".yf_faq_section button.yf_modal_close, .yf_desc_section button.yf_modal_close", function(e) {
            e.preventDefault();
            var $this = $(this);
            if ( $this.closest(".yf_faq_section").length > 0 ) {
                $this.closest(".yf_faq_section").hide();
            } else if ( $this.closest(".yf_desc_section").length > 0 ) {
                $this.closest(".yf_desc_section").hide();
            }
            $("body").removeClass("yf_modal_active");
        });
        $(document).mouseup(function(e) {
            var container = $(".yf_modal");
            if (!container.is(e.target) && container.has(e.target).length === 0) {
                container.closest(".yf_child_item").find(".yf_faq_section, .yf_desc_section").hide();
                $("body").removeClass("yf_modal_active");
            }
        });

        /*
        * Ajax loaded playlist
        */
        $(document).on('click touchend', '.yf_view_section .epyt-gallery-list .epyt-gallery-thumb', function (e) {
            var $container = $(this).closest(".epyt-gallery");
            $iframe = $container.find('iframe, div.__youtube_prefs_gdpr__').first();
            if (window._EPYT_.touchmoved) {
                return;
            }
            if (!$(this).hasClass('epyt-current-video') || $container.hasClass('epyt-lb')) {
                $container.find('.epyt-gallery-list .epyt-gallery-thumb').removeClass('epyt-current-video');
                $(this).addClass('epyt-current-video');
                var vid = $(this).data('videoid');
                $container.data('currvid', vid);
                var vidSrc = $container.data('ep-gallerysrc').replace('GALLERYVIDEOID', vid);

                var thumbplay = $container.find('.epyt-pagebutton').first().data('thumbplay');
                if (thumbplay !== '0' && thumbplay !== 0) {
                    if (vidSrc.indexOf('autoplay') > 0) {
                        vidSrc = vidSrc.replace('autoplay=0', 'autoplay=1');
                    } else {
                        vidSrc += '&autoplay=1';
                    }
                    $iframe.addClass('epyt-thumbplay');
                }

                if ($container.hasClass('epyt-lb')) {
                    window._EPADashboard_.lb('#' + contentlbid);
                    vidSrc = vidSrc.replace('autoplay=1', 'autoplay=0');
                    if ($iframe.is('[data-ep-src]')) {
                        $iframe.data('ep-src', vidSrc);
                        $iframe.attr('data-ep-src', vidSrc);
                    } else {
                        window._EPADashboard_.setVidSrc($iframe, vidSrc);
                    }
                    $('.lity-close').focus();
                } else {
                    if ($container.find('.epyt-gallery-style-carousel').length === 0) {
                        // https://github.com/jquery/jquery-ui/blob/master/ui/scroll-parent.js
                        var bodyScrollTop = Math.max($('body').scrollTop(), $('html').scrollTop());
                        var scrollNext = $iframe.offset().top - parseInt(_EPYT_.gallery_scrolloffset);
                        if (bodyScrollTop > scrollNext) {
                            $('html, body').animate({
                                scrollTop: scrollNext
                            }, 500, function () {
                                window._EPADashboard_.setVidSrc($iframe, vidSrc);
                            });
                        } else {
                            window._EPADashboard_.setVidSrc($iframe, vidSrc);
                        }
                    } else {
                        window._EPADashboard_.setVidSrc($iframe, vidSrc);
                    }
                }
            }
        }).on('touchmove', function (e) {
            window._EPYT_.touchmoved = true;
        }).on('touchstart', function () {
            window._EPYT_.touchmoved = false;
        }).on('keydown', '.yf_view_section .epyt-gallery-list .epyt-gallery-thumb, .epyt-pagebutton', function (e) {
            var code = e.which;
            if ((code === 13) || (code === 32)) {
                e.preventDefault();
                $(this).click();
            }
        });

        $(document).on('mouseenter', '.yf_view_section .epyt-gallery-list .epyt-gallery-thumb', function () {
            $(this).addClass('hover');
            var $container = $(this).closest(".epyt-gallery");
            var $listgallery = $container.find('.epyt-gallery-list');
            if ($listgallery.hasClass('epyt-gallery-style-carousel') && $container.find('.epyt-pagebutton').first().data('showtitle') == 1) {
                $container.find('.epyt-pagenumbers').addClass('hide');
                var ttl = $(this).find('.epyt-gallery-notitle span').text();
                $container.find('.epyt-gallery-rowtitle').text(ttl).addClass('hover');
            }
        });

        $(document).on('mouseleave', '.yf_view_section .epyt-gallery-list .epyt-gallery-thumb', function () {
            $(this).removeClass('hover');
            var $container = $(this).closest(".epyt-gallery");
            var $listgallery = $container.find('.epyt-gallery-list');
            if ($listgallery.hasClass('epyt-gallery-style-carousel') && $container.find('.epyt-pagebutton').first().data('showtitle') == 1) {
                $container.find('.epyt-gallery-rowtitle').text('').removeClass('hover');
                if ($container.find('.epyt-pagebutton[data-pagetoken!=""]').length > 0)
                {
                    $container.find('.epyt-pagenumbers').removeClass('hide');
                }
            }
        });

        $(document).on('click touchend', '.yf_view_section .epyt-pagebutton', function (ev) {
            var $container = $(this).closest(".epyt-gallery");
            if (window._EPYT_.touchmoved) {
                return;
            }
            if (!$container.find('.epyt-gallery-list').hasClass('epyt-loading')) {
                $container.find('.epyt-gallery-list').addClass('epyt-loading');
                var humanClick = typeof (ev.originalEvent) !== 'undefined';
                var pageData = {
                    action: 'my_embedplus_gallery_page',
                    security: _EPYT_.security,
                    options: {
                        playlistId: $(this).data('playlistid'),
                        pageToken: $(this).data('pagetoken'),
                        pageSize: $(this).data('pagesize'),
                        columns: $(this).data('epcolumns'),
                        showTitle: $(this).data('showtitle'),
                        showPaging: $(this).data('showpaging'),
                        autonext: $(this).data('autonext'),
                        hidethumbimg: $(this).data('hidethumbimg'),
                        style: $(this).data('style'),
                        thumbcrop: $(this).data('thumbcrop'),
                        showDsc: $(this).data('showdsc'),
                        thumbplay: $(this).data('thumbplay')
                    }
                };
                if ($(this).data('showdsc')) {
                    pageData.options.showDsc = $(this).data('showdsc');
                }

                var forward = $(this).hasClass('epyt-next');
                var currpage = parseInt($container.data('currpage') + "");
                currpage += forward ? 1 : -1;
                $container.data('currpage', currpage);

                $.post(_EPYT_.ajaxurl, pageData, function (response) {
                    $container.find('.epyt-gallery-list').html(response);
                    $container.find('.epyt-current').each(function () {
                        $(this).text($container.data('currpage'));
                    });
                    $container.find('.epyt-gallery-thumb[data-videoid="' + $container.data('currvid') + '"]').addClass('epyt-current-video');


                    if ($container.find('.epyt-pagebutton').first().data('autonext') == '1' && !humanClick) {
                        $container.find('.epyt-gallery-thumb').first().click();
                    }
                }) .fail(function () {
                    alert('Sorry, there was an error loading the next page.');
                }) .always(function () {
                    $container.find('.epyt-gallery-list').removeClass('epyt-loading');
                    pagenumsalign();
                    if ($container.find('.epyt-gallery-style-carousel').length === 0 && $container.find('.epyt-pagebutton').first().data('autonext') != '1') {
                        // https://github.com/jquery/jquery-ui/blob/master/ui/scroll-parent.js
                        var bodyScrollTop = Math.max($('body').scrollTop(), $('html').scrollTop());
                        var scrollNext = $container.find('.epyt-gallery-list').offset().top - parseInt(_EPYT_.gallery_scrolloffset);
                        if (bodyScrollTop > scrollNext) {
                            $('html, body').animate({
                                scrollTop: scrollNext
                            }, 500);
                        }
                    }
                });
            }
        }).on('touchmove', function (e) {
            window._EPYT_.touchmoved = true;
        }).on('touchstart', function () {
            window._EPYT_.touchmoved = false;
        });

        /*
        * Social links
        */
        $('td .link .yf_social').yfinfo();
        $('body').on('click', function (e) {
            $('td .link .yf_social').each(function (i, element) {
                if (!$(element).is(e.target) && $(element).has(e.target).length === 0 && $('.yfinfo').has(e.target).length === 0) {
                    (($(element).yfinfo('hide').data('bs.yfinfo')||{}).inState||{}).click = false;
                }
            });
        });

        /*
        * Playlist select
        */
        $(document).on("change", ".yf_view_head .yf_view_pagi select[name='yf_view_sel']", function(e) {
            var $element = $(this);
            var channelid = $element.attr("data-id");
            var playlistid = $element.children("option:selected").val();

            if (!isEmpty(playlistid) && !isEmpty(channelid)) {
                $parent = $element.closest(".yf_view_section");
                loadView(channelid, playlistid, $parent, $element);
            }
        });

        $(document).on("click", ".yf_view_head .yf_view_pagi .yf_view_btn:not(.disabled)", function(e) {
            var $element = $(this);
            if ($element.hasClass("prev")) {
                var channelid = $element.closest(".yf_view_pagi").find("select[name='yf_view_sel']").attr("data-id");
                var playlistid = $element.closest(".yf_view_pagi").find("select[name='yf_view_sel']").children("option:selected").prev().val();
            } else if ($element.hasClass("next")) {
                var channelid = $element.closest(".yf_view_pagi").find("select[name='yf_view_sel']").attr("data-id");
                var playlistid = $element.closest(".yf_view_pagi").find("select[name='yf_view_sel']").children("option:selected").next().val();
            }

            if (!isEmpty(channelid) && !isEmpty(playlistid)) {
                $parent = $element.closest(".yf_view_section");
                var select = $element.closest(".yf_view_pagi").find("select[name='yf_view_sel']");
                loadView(channelid, playlistid, $parent, select);
            }
        });

        /*
        * Description collapse/expand
        */
        $(document).on("click", ".yt-desc > span.yf-desc-more", function(e) {
            var $this = $(this);
            var $parent = $this.closest(".yf-desc-block");
            if ( $this.hasClass("yt-collapse") ) {
                $parent.find(".yf-desc-text").hide();
                $parent.find(".yt-desc span.yf-desc-excerpt").show();
                $this.text("Read More").removeClass("yt-collapse");
            } else {
                $parent.find(".yt-desc span.yf-desc-excerpt").hide();
                $parent.find(".yf-desc-text").show();
                $this.text("Read Less").addClass("yt-collapse");
            }
        });

        /*
        * Main block sort
        */
        $(".yf-fetch-head select[name='sort_ft']").each(function(i, element){
            var dval = $(element).children("option:selected").val();
            var sortby = $(element).children("option:selected").attr("data-sort");
            var sorttpye = (!isEmpty(sortby) && (sortby == 'asc' || sortby == 'desc')) ? sortby : 'desc' ;
            if ( dval != '-1' ) {
                var darrayVal = [];
                $(element).closest(".yf-fetch-block").find(".yf-fetch-content .yfetch-items").each(function(i, item){
                    darrayVal.push($(item).data(dval));
                });
                if ( darrayVal && darrayVal.length > 0 ) {
                    if( Object.prototype.toString.call(darrayVal[0]) == '[object String]' ) {
                        darrayVal.sort();
                    } else {
                        darrayVal.sort(function(a, b) { return +a - +b; });
                    }
                    if ( sorttpye == 'desc' ) {
                        darrayVal.reverse();
                    }
                    $(element).closest(".yf-fetch-block").find(".yf-fetch-content .yfetch-items").each(function(i, sitem){
                        var order = $.inArray( $(sitem).data(dval), darrayVal );
                        $(sitem).css({"-ms-flex-order": order, "order": order});
                    });
                }
            }
        });

        $(document).on("change", ".yf-fetch-head select[name='sort_ft']", function(e) {
            var $this = $(this);
            var value = $this.children("option:selected").val();
            var sortdata = $this.children("option:selected").attr("data-sort");
            var sortbyd = (!isEmpty(sortdata) && (sortdata == 'asc' || sortdata == 'desc')) ? sortdata : 'desc' ;
            if ( value != '-1' ) {
                var parent = $this.closest(".yf-fetch-block");
                var arrayVal = [];
                parent.find(".yf-fetch-content .yfetch-items").each(function(i, item){
                    arrayVal.push($(item).data(value));
                });
                if ( arrayVal && arrayVal.length > 0 ) {
                    if( Object.prototype.toString.call(arrayVal[0]) == '[object String]' ) {
                        arrayVal.sort();
                    } else {
                        arrayVal.sort(function(a, b) { return +a - +b; });
                    }
                    if ( sortbyd == 'desc' ) {
                        arrayVal.reverse();
                    }
                    parent.find(".yf-fetch-content .yfetch-items").each(function(i, sitem){
                        var order = $.inArray( $(sitem).data(value), arrayVal );
                        $(sitem).css({"-ms-flex-order": order, "order": order});
                    });
                }
            }
        });

        /*
        * Main block pagination
        */
        $(document).on("click", ".yf-fetch-block .yf-paginate > a", function(e) {
            e.preventDefault();
            var $this = $(this);
            var $parent = $this.closest(".yf-fetch-innr");
            var paged = $this.attr("data-paged");
            var key = $parent.find(".yf-fetch-content").attr("data-id");
            var post_id = $parent.find(".yf-fetch-content").attr("post-id");
            var per_page = 10;
            var option = $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page'] > option:selected").val();
            var per_page = (option == 5 || option == 10 || option == 15 || option == 20) ? option : 10 ;

            if ( !isEmpty(key) && !isEmpty(post_id) ) {
                $.ajax({
                    url: yfetch.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'yfetch_load_main',
                        key: key,
                        id: post_id,
                        paged: paged,
                        item: per_page
                    },
                    beforeSend: function() {
                        $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr("disabled", true);
                        $parent.addClass("disabled");
                    },
                    success: function(output) {
                        $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr("disabled", false);
                        $parent.html(output).removeClass("disabled");
                    }
                });
            } else {
                $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr('disabled', true);
                $parent.addClass("disabled");
                setTimeout(function(){
                    $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr('disabled', false);
                    var append = '<div call="yf-fetch-content"><p>'+yfetch.brokenlink+'</p></div>';
                    $parent.html(append).removeClass("disabled");
                }, 1000);
            }
        });

        /*
        * Item per page
        */
        $(".yf-fetch-head select[name='per_page'] option[value='10']").prop('selected', true);
        $(document).on("change", ".yf-fetch-head select[name='per_page']", function(e) {
            var $this = $(this);
            var $parent = $this.closest(".yf-fetch-block").find(".yf-fetch-innr");
            var option = $this.children("option:selected").val();
            var per_page = (option == 5 || option == 10 || option == 15 || option == 20) ? option : 10 ;
            var key = $parent.find(".yf-fetch-content").attr("data-id");
            var post_id = $parent.find(".yf-fetch-content").attr("post-id");

            if ( !isEmpty(key) && !isEmpty(post_id) ) {
                $.ajax({
                    url: yfetch.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'yfetch_load_main',
                        key: key,
                        id: post_id,
                        paged: 1,
                        item: per_page
                    },
                    beforeSend: function() {
                        $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr("disabled", true);
                        $parent.addClass("disabled");
                    },
                    success: function(output) {
                        $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr("disabled", false);
                        $parent.html(output).removeClass("disabled");
                    }
                });
            } else {
                $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr('disabled', true);
                $parent.addClass("disabled");
                setTimeout(function(){
                    $this.closest(".yf-fetch-block").find(".yf-fetch-head select[name='per_page']").attr('disabled', false);
                    var append = '<div call="yf-fetch-content"><p>'+yfetch.brokenlink+'</p></div>';
                    $parent.html(append).removeClass("disabled");
                }, 1000);
            }
        });
    });
})(window, jQuery);