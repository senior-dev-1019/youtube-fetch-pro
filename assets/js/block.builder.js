(function(wp) {
   var el = wp.element.createElement;
   const icon_widget = el('svg', 
      {
         width: 25,
         height: 25
      },
      el( 'path', { 
         d: "M9.24,3.78H.54A.55.55,0,0,0,0,4.33V13a.55.55,0,0,0,.54.55h8.7A.55.55,0,0,0,9.78,13V4.33A.55.55,0,0,0,9.24,3.78Zm-.55,8.7H1.09V4.87h7.6Zm.55,2.17H.54A.55.55,0,0,0,0,15.2v8.69a.54.54,0,0,0,.54.54h8.7a.54.54,0,0,0,.54-.54V15.2A.55.55,0,0,0,9.24,14.65Zm-.55,8.7H1.09V15.74h7.6Zm11.42-8.7h-8.7a.55.55,0,0,0-.54.55v8.69a.54.54,0,0,0,.54.54h8.7a.54.54,0,0,0,.54-.54V15.2A.55.55,0,0,0,20.11,14.65Zm-.55,8.7H12V15.74h7.6ZM24.73,5,17.19.64a.54.54,0,0,0-.74.2h0L12.1,8.37a.54.54,0,0,0,.2.74h0l7.53,4.34a.55.55,0,0,0,.75-.19h0l4.35-7.53a.54.54,0,0,0-.2-.74Zm-4.82,7.25-6.59-3.8,3.8-6.59,6.59,3.8Z" 
      })
   );
   const allowed_Blocks = ["core/shortcode", "epyt/youtube"];
   const enabled_blocks = ["core/shortcode", "epyt/youtube", "yfetch/channel-table"];
   const embeed_plus    = ["epyt/youtube"];
   const channel_short  = ["core/shortcode", "yfetch/channel-table"];

   wp.hooks.addFilter('blocks.registerBlockType', 'yfetch/blocktype', function(settings, name) {
      if (typeof settings.attributes !== 'undefined' && embeed_plus.includes(name)) {
         settings.attributes = lodash.assign({}, settings.attributes, {
            channelLink: {
               type: 'string',
               default: yfetch.home_url
            },
            description: {
               type: 'string',
               default: ''
            },
            loaded: {
               type: 'string',
               default: ''
            }
         });
      } else if (typeof settings.attributes !== 'undefined' && channel_short.includes(name)) {
         settings.attributes = lodash.assign({}, settings.attributes, {
            channelLink: {
               type: 'string',
               default: yfetch.home_url
            },
            description: {
               type: 'string',
               default: ''
            },
            loaded: {
               type: 'string',
               default: ''
            },
            socialInfo: {
               type: 'array'
            }
         });
      }
      return settings;
   });

   const withSpacingControl = wp.compose.createHigherOrderComponent(function(BlockEdit) {
      return function(props) {
         if (enabled_blocks.includes(props.name)) {
            var parentblocks = wp.data.select( 'core/block-editor' ).getBlockParents(props.clientId); 
            var parentAttributes = wp.data.select('core/block-editor').getBlocksByClientId(parentblocks);
            var is_enable = false; var is_rel = false;
            if ( parentAttributes.length >= 1 ) {
               for (i = 0; i < parentAttributes.length; i++) {
                  if ( parentAttributes[i].name == "yfetch/block-main" ) {
                     is_enable = true;
                  } else if ( parentAttributes[i].name == "yfetch/block-related" ) {
                     is_enable = true;
                     is_rel = true;
                  }
               }  
            }
            if (props.attributes.text) {
               var texts = props.attributes.text;
            } else if (props.attributes.shortcode) {
               var texts = props.attributes.shortcode;
            }

            if (is_enable && texts && props.attributes.loaded != texts) {
               var text = texts.replace(/\[yfetch\s\]|\[yfetch\]|\[\/yfetch\]|\[[yf_rel]\s\]|\[[yf_rel]\]|\[\/[yf_rel]\]|\[embedyt\s\]|\[embedyt\]|\[\/embedyt\]/g, ' ');
               var urlRegex = /((?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/[^ ]*))/;
               var url = (text.match(urlRegex) != null) ? text.match(urlRegex)[1].trim() : '';
               if (url != "") {
                  jQuery.ajax({
                     url: yfetch.ajax_url,
                     type: 'POST',
                     data: {
                        action: 'yfetch_channel_addinfo',
                        url: url
                     },
                     success: function(output) {
                        if (output != '') {
                           var outputs = jQuery.parseJSON(output);
                           if ( "desc" in outputs ) {
                              props.setAttributes({ description: outputs.desc });
                           }
                           if ( is_rel && "social" in outputs) {
                              props.setAttributes({ socialInfo: outputs.social });
                           }
                           props.setAttributes({ loaded: texts });
                        }
                     }
                  });
               }
            }
            return el(
               wp.element.Fragment, {},
               el(
                  BlockEdit,
                  props
               ),
               el(
                  wp.blockEditor.InspectorControls, null,
                  is_enable && el(
                     wp.components.PanelBody, {
                        title: wp.i18n.__('YFetch additional info', 'yfetch'),
                        initialOpen: true
                     },
                     el(
                        wp.components.TextControl, {
                           label: wp.i18n.__('Channel URL', 'yfetch'),
                           value: props.attributes.channelLink.replace(/ +/g, '-').trim(),
                           onChange: function(value) {
                              props.setAttributes({ channelLink: value });
                           }
                        }
                     ),
                     el(
                        wp.components.TextareaControl, {
                           label: wp.i18n.__('Video description', 'yfetch'),
                           help: wp.i18n.__('This will replace the default description', 'yfetch'),
                           value: props.attributes.description,
                           onChange: function(value) {
                              props.setAttributes({ description: value });
                           }
                        }
                     )
                  )
               )
            )
         } else {
            return el(
               wp.element.Fragment, {},
               el(
                  BlockEdit,
                  props
               )
            )
         }
      }
   }, 'withSpacingControl');
   wp.hooks.addFilter('editor.BlockEdit', 'yfetch/blockedit', withSpacingControl);

   wp.blocks.registerBlockType("yfetch/block-related", {
      title: wp.i18n.__("Yfetch Related Block"),
      description: wp.i18n.__("Add a pre-defined layout for channel information."),
      icon: "list-view",
      category: "layout",
      keywords: ["layout", "row", "yfetch", "related"],
      attributes: {
         title: {
            type: 'string',
            default: ''
         },
         id: {
            type: 'string',
            default: ''
         }
      },
      edit: function(props) {
         props.setAttributes({ id: props.clientId });
         return el('div', { className: props.className },
            el(
               wp.blockEditor.InnerBlocks, { allowedBlocks: ["core/shortcode", "yfetch/channel-table"] }
            ),
            el(
               wp.blockEditor.InspectorControls, null,
               el(
                  wp.components.PanelBody, {
                     title: wp.i18n.__('YFetch block info', 'yfetch'),
                     initialOpen: true
                  },
                  el(
                     wp.components.TextControl, {
                        label: 'Block title',
                        value: props.attributes.title,
                        onChange: function(value) {
                           props.setAttributes({ title: value });
                        }
                     }
                  )
               )
            )
         );
      },
      save: function(props) {
         return el(wp.blockEditor.InnerBlocks.Content);
      },
   });

   wp.blocks.registerBlockType("yfetch/block-main", {
      title: wp.i18n.__("Yfetch Channel Block"),
      description: wp.i18n.__("Add a pre-defined layout for channel embed."),
      icon: "editor-table",
      category: "layout",
      keywords: ["layout", "row", "yfetch", "channel"],
      attributes: {
         id: {
            type: 'string',
            default: ''
         },
         title: {
            type: 'string',
            default: ''
         }
      },
      edit: function(props) {
         props.setAttributes({ id: props.clientId });
         return el('div', { className: props.className },
            el(
               wp.blockEditor.InnerBlocks, { allowedBlocks: allowed_Blocks }
            ),
            el(
               wp.blockEditor.InspectorControls, null,
               el(
                  wp.components.PanelBody, {
                     title: wp.i18n.__('YFetch block info', 'yfetch'),
                     initialOpen: true
                  },
                  el(
                     wp.components.TextControl, {
                        label: wp.i18n.__('Block title', 'yfetch'),
                        value: props.attributes.title,
                        onChange: function(value) {
                           props.setAttributes({ title: value });
                        }
                     }
                  )
               )
            )
         );
      },
      save: function(props) {
         return el(wp.blockEditor.InnerBlocks.Content);
      },
   });


   wp.blocks.registerBlockType('yfetch/channel-table', {
      title: wp.i18n.__('Yfetch Channel Table'),
      description: wp.i18n.__('A custom block for displaying channel information.'),
      icon: 'excerpt-view',
      category: 'layout',
      keywords: ["layout", "yfetch", "related", "block"],
      attributes: {
         shortcode: {
            type: 'string',
            default: ''
         }
      },
      edit: function(props) {
         const [ isOpen, setOpen ] = wp.element.useState( false );
         function openModal() {
            setOpen(true);
         }
         function closeModal(){
            setOpen(false);
         }
         jQuery(document).one("click", "button.yf-ins-button", function(e) {
            var event = jQuery(this);
            var shortcode = event.closest(".yf-modal-innr").find("input[type='text'].yf-shortc").val();
            if ( props.attributes.shortcode == '' ) {
               props.setAttributes({ shortcode: shortcode });
            }
            setOpen(false);
            e.preventDefault();
         });
         return [
            el('div', { className: props.className },
               props.attributes.shortcode && props.attributes.shortcode != '' && el( wp.serverSideRender, {
                  block: 'yfetch/channel-table',
                  attributes: {
                     shortcode: props.attributes.shortcode,
                     channelLink: props.attributes.channelLink
                  },
               }),
               props.attributes.shortcode == '' && el( wp.components.Placeholder, {
                     className: 'yf-block',
                     icon: el( wp.components.Icon, {size: 20, icon: icon_widget}),
                     label: wp.i18n.__('YFetch Channel Wizard', 'yfetch'),
                     instructions: wp.i18n.__('Click the button below to easily add channel', 'yfetch'),
                  },
                  el( wp.components.Button, {
                        className: 'yf-modal-button',
                        disabled: false,
                        isSecondary: true,
                        onClick: openModal
                     },
                     wp.i18n.__('Open Modal', 'yfetch')
                  )
               ),
               isOpen && el( wp.components.Modal, {
                     onRequestClose: closeModal,
                     shouldCloseOnEsc: false,
                     shouldCloseOnClickOutside: false,
                     title: wp.i18n.__('YFetch Modal', 'yfetch'),
                     className: 'yf-modal'
                  },
                  el( 'div', 
                     { 
                        className: 'yf-modal-content' 
                     },
                     el( 'h3', {
                           className: 'yf-modal-title',
                           align: 'center'
                        },
                        wp.i18n.__('Channel directions', 'yfetch')
                     ),
                     el( 'p', null,
                        wp.i18n.__('If you already know the direct link to the channel, enter it below.', 'yfetch'),
                        el('br', null, null),
                        wp.i18n.__('Example: https://www.youtube.com/', 'yfetch'),
                        el('strong', null, wp.i18n.__('channel', 'yfetch')),
                        wp.i18n.__('/UCnM5iMGiKsZg-iOlIO2ZkdQ', 'yfetch')
                     ),
                     el( 'p', null,
                        wp.i18n.__('Or, simply enter a link to any single video that belongs to the user\'s channel, and the plugin will find the channel for you.', 'yfetch'),
                        el('br', null, null),
                        wp.i18n.__('Example: https://www.youtube.com/watch?v=YVvn8dpSAt0', 'yfetch')
                     ),
                     el( 'form', {
                           action: '#', 
                           className: 'yf-modal-frm',
                           method: 'POST' 
                        },
                        el( 'div', 
                           { 
                              className: 'yf-modal-form' 
                           },
                           el( 'input', { 
                              type: 'text',
                              name: "txtUrlChannel",
                              placeholder : wp.i18n.__('Enter YouTube Channel link here', 'yfetch'),
                           }),
                           el( wp.components.Button, {
                                 className: 'yf-form-button',
                                 disabled: false,
                                 isSecondary: true,
                                 isPressed: true
                              },
                              wp.i18n.__('Get Channel', 'yfetch')
                           )
                        ),
                        el('div', {className: 'yf-error-msg'}, null)
                     ),
					 el( 'form', {
                           action: '#', 
                           className: 'yf-modal-bulk-frm',
                           method: 'POST' 
                        },
                        el( 'div', 
                           { 
                              className: 'yf-modal-bulk-form' 
                           },
                           el( 'input', { 
                              type: 'file',
                              name: "bulkTxtUrlChannel",
                              placeholder : wp.i18n.__('Upload csv here', 'yfetch'),
                           }),
                           el( wp.components.Button, {
                                 className: 'yf-form-bulk-button',
                                 disabled: false,
                                 isSecondary: true,
                                 isPressed: true
                              },
                              wp.i18n.__('Get Channels', 'yfetch')
                           )
                        ),
                        el('div', {className: 'yf-error-msg'}, null)
                     )
                  )
               )
            )
         ]
      },
      save: function(props) {
         return props.attributes.shortcode;
      }
   });
}(window.wp));