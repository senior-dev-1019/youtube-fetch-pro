(function($) {
    $(document).on('ready', function() {
        jQuery(document).on("focus", "input[type='text'].yf-shortc", function(e) {
            jQuery(this).select();
        });
		
		jQuery(document).on("click", "button.yf-form-bulk-button", function(){
			var csv = jQuery("input[name='bulkTxtUrlChannel']");
			var csvFile = csv[0].files[0];
			var ext = csv.val().split(".").pop().toLowerCase();

			if(jQuery.inArray(ext, ["csv"]) === -1){
				alert('upload csv');
				return false;
			}
			if(csvFile != undefined){
				reader = new FileReader();
				reader.onload = function(e){

					csvResult = e.target.result.split(/\r|\n|\r\n/);
					var csvResultnew = csvResult.filter(function (el) {
						return el != null && el != "";
					});
					console.log(csvResultnew);
				}
				reader.readAsText(csvFile);
			}
		});
		
        jQuery(document).on("click", "button.yf-form-button", function(e) {
            var event = jQuery(this);
            var parent = event.closest(".yf-modal-frm");
            var input = parent.find("input[type='text']").val();
            var p = /^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:channel\/((\w|-){24})|(?:embed\/|v\/|watch\?v=|watch\?.+&v=)((\w|-){11})))(?:(?:&|\/|\?)(.*)|\s+|)$/;
            if (input.match(p)) {
                var nyids = (RegExp.$1 != '') ? RegExp.$1 : RegExp.$3;
            } else {
                var nyids = false
            }
            if ( nyids ) {
                jQuery.ajax({
                    url: yfetch.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'yfetch_is_valid_yid',
                        id: nyids
                    },
                    beforeSend: function() {
                        event.closest(".yf-modal-content").addClass("disabled");
                    },
                    success: function(output) {
                        if (output != '') {
                            var out = jQuery.parseJSON(output);
                            if ( "id" in out ) {
                                var returns = '<div class="yf-modal-innr"><h3 class="yf-modal-title" align="center">Channel: '+out.title+'</h3>' 
                                + '<button type="button" class="yf-ins-button" data-id="'+out.id+'" data-faqs=""><span class="dashicons dashicons-upload"></span> Insert Channel</button>'
                                + '<p>Or Copy Shortcode:</p>'
                                + '<input type="text" class="yf-shortc" value="[yf_rel] https://www.youtube.com/channel/'+out.id+' [/yf_rel]"/></div>';
                                event.closest(".yf-modal-content").html(returns).removeClass("disabled");
                            } else {
                                var append = 'Sorry, that does not seem to be a link to an existing video.  Please confirm that the link works in your browser, and that <em>the owner of the video allowed embed sharing permissions (otherwise, contact the owner of the video to allow embedding)</em>. Then copy that full link in your address bar to paste here. If you are sure your link is correct, then (1) your API key may be too restrictive (<a target="_blank" href="https://console.developers.google.com/apis/credentials">check here</a>) or (2) you have reached your Google quota (<a href="https://console.developers.google.com/apis/dashboard" target="_blank">check here</a>). You can apply to Google for a <a href="https://services.google.com/fb/forms/ytapiquotarequest/" target="_blank">quota increase here</a>.';
                                parent.find(".yf-error-msg").html(append);
                                event.closest(".yf-modal-content").removeClass("disabled");
                            }
                        } else {
                            var append = 'Sorry, that does not seem to be a link to an existing video.  Please confirm that the link works in your browser, and that <em>the owner of the video allowed embed sharing permissions (otherwise, contact the owner of the video to allow embedding)</em>. Then copy that full link in your address bar to paste here. If you are sure your link is correct, then (1) your API key may be too restrictive (<a target="_blank" href="https://console.developers.google.com/apis/credentials">check here</a>) or (2) you have reached your Google quota (<a href="https://console.developers.google.com/apis/dashboard" target="_blank">check here</a>). You can apply to Google for a <a href="https://services.google.com/fb/forms/ytapiquotarequest/" target="_blank">quota increase here</a>.';
                            parent.find(".yf-error-msg").html(append);
                            event.closest(".yf-modal-content").removeClass("disabled");
                        }
                    }
                });
            } else {
                if ( parent.find(".yf-error-msg").length > 0 ) {
                    event.closest(".yf-modal-content").addClass("disabled");
                    setTimeout(function(){
                        var append = 'Sorry, that does not seem to be a link to an existing video.  Please confirm that the link works in your browser, and that <em>the owner of the video allowed embed sharing permissions (otherwise, contact the owner of the video to allow embedding)</em>. Then copy that full link in your address bar to paste here. If you are sure your link is correct, then (1) your API key may be too restrictive (<a target="_blank" href="https://console.developers.google.com/apis/credentials">check here</a>) or (2) you have reached your Google quota (<a href="https://console.developers.google.com/apis/dashboard" target="_blank">check here</a>). You can apply to Google for a <a href="https://services.google.com/fb/forms/ytapiquotarequest/" target="_blank">quota increase here</a>.';
                        parent.find(".yf-error-msg").html(append);
                        event.closest(".yf-modal-content").removeClass("disabled");
                    }, 1000);
                }
            }
            e.preventDefault();
        });
    });
})(jQuery);