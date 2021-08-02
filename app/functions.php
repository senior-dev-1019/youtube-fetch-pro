<?php if ( ! defined( 'ABSPATH' ) )
	exit;

/**
 * Functions
 */
class Yfetch_functions {
	protected static $instance = null;
	public static $opt_alloptions = 'youtubeprefspro_alloptions';
	public static $opt_apikey = 'apikey';
	public static $alloptions = null;
	public static $curltimeout = 30;
	public static $opt_spdc = 'spdc';
	public static $opt_pro = 'pro';
	public static $opt_spdcexp = 'spdcexp';
	public static $spdcprefix = 'ytpref';
	public static $justurlregex = '@https?://(?:www\.)?(?:(?:youtube.com/(?:(?:watch)|(?:embed)|(?:playlist))(?:/live_stream){0,1}/{0,1}\?)|(?:youtu.be/))([^\[\s"]+)@i';
	public static $scoderegex = '/\[(\[?)(embedyt|embed\-vi\-ad|yf_rel)(?![\w-])([^\]\/]*(?:\/(?!\])[^\]\/]*)*?)(?:(\/)\]|\](?:([^\[]*+(?:\[(?!\/\2\])[^\[]*+)*+)\[\/\2\])?)(\]?)/s';
	public static $channelregex = '@https?://(?:www\.)?youtu((\.be)|(be\..{2,5}))\/channel\/([^"&?\/ ]{24})@i';
	public static $badentities = array('&#215;', '×', '&#8211;', '–', '&amp;', '&#038;', '&#38;');
	public static $goodliterals = array('x', 'x', '--', '--', '&', '&', '&');

	public static function instance() {
		return null == self::$instance ? new self : self::$instance;
	}

	public function __construct() {
		self::$alloptions = get_option(self::$opt_alloptions);
	}
	/**
	 * Number format
	 * Convert number to K, M, B, T
	 * @return string
	 */
	public static function number_format_short( $n, $precision = 1 ) {
		$n = (float)$n;
        if ($n < 900) {
            $n_format = number_format($n, $precision);
            $suffix = '';
        } else if ($n < 900000) {
            $n_format = number_format($n / 1000, $precision);
            $suffix = 'K';
        } else if ($n < 900000000) {
            $n_format = number_format($n / 1000000, $precision);
            $suffix = 'M';
        } else if ($n < 900000000000) {
            $n_format = number_format($n / 1000000000, $precision);
            $suffix = 'B';
        } else {
            $n_format = number_format($n / 1000000000000, $precision);
            $suffix = 'T';
        }
        if ( $precision > 0 ) {
            $dotzero = '.' . str_repeat( '0', $precision );
            $n_format = str_replace( $dotzero, '', $n_format );
        }
        return $n_format .' '. $suffix;
    }

    /**
	 * Check if id is valid channel / video id
	 *
	 * @return array
	 */
    public static function is_valid_yid( $yid ) {
        $id = trim($yid);
        $id_type = "";
        $channelinfo = [];
        if ( strlen($id) == 11 ) {
        	$id_type = 'info_video';
        } else if ( strlen($id) == 24 ) {
        	$id_type = 'info_channel';
        } else {
        	return $channelinfo;
        }

        if (!empty($id_type) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1) {
        	$spdckey = self::$spdcprefix . '_' . md5($id) .'_'. $id_type;
        	$spdcval = get_transient($spdckey);
            if ( !empty($spdcval) ) {
                return $spdcval;
            }
        }

        if ( $id_type == 'info_video' ) {
            $apiEndpoint = 'https://www.googleapis.com/youtube/v3/videos?id=' . urlencode($id) . '&part=snippet&key=' . self::$alloptions[self::$opt_apikey];
            if ( !empty($apiEndpoint) ) {
                $apiResult = wp_remote_get($apiEndpoint, array('timeout' => self::$curltimeout));
                if (!is_wp_error($apiResult)) {
                    $jsonResult = json_decode($apiResult['body']);
                    if (!isset($jsonResult->error) && isset($jsonResult->items) && $jsonResult->items != null && is_array($jsonResult->items)) {
                    	if ( isset($jsonResult->items[0]->snippet->channelId) ) {
                    		$channelinfo['id'] = $jsonResult->items[0]->snippet->channelId;
                    	}
                    	if ( isset($jsonResult->items[0]->snippet->channelTitle) ) {
                    		$channelinfo['title'] = $jsonResult->items[0]->snippet->channelTitle;
                    	}
                    }
                }
            }
        } else if ( $id_type == 'info_channel' ) {
            $apiEndpoint = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&id=' . urlencode($id) . '&maxResults=1&key=' . self::$alloptions[self::$opt_apikey];
            if ( !empty($apiEndpoint) ) {
	            $apiResult = wp_remote_get($apiEndpoint, array('timeout' => self::$curltimeout));
	            if (!is_wp_error($apiResult)) {
	                $jsonResult = json_decode($apiResult['body']);
	                if (!isset($jsonResult->error) && isset($jsonResult->items) && $jsonResult->items != null && is_array($jsonResult->items)) {
	                    if ( isset($jsonResult->items[0]->id) ) {
	                    	$channelinfo['id'] = $jsonResult->items[0]->id;
	                    }
	                    if ( isset($jsonResult->items[0]->snippet->title) ) {
	                    	$channelinfo['title'] = $jsonResult->items[0]->snippet->title;
	                    }
	                }
	            }
	        }
        }
        if (!empty($channelinfo) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1 && !empty($spdckey)) {
        	$exp = self::$alloptions[self::$opt_spdcexp] * 60 * 60;
        	set_transient($spdckey, $channelinfo, $exp);
        }
        return $channelinfo;
    }

    /**
	 * Get youtube channel statics
	 *
	 * @return string
	 */
    public static function get_channel_statics( $yid, $is_playlist = "videos" ) {
    	$id = trim($yid);
    	$id_type = $apiChannel = '';
        $channelinfo = new stdClass();
        if ( $is_playlist == "videos" ) {
        	$id_type = 'static_video';
        } else if ( $is_playlist == "playlist" ) {
        	$id_type = 'static_list';
        } else if ( $is_playlist == "channel" ) {
        	$id_type = 'static_channel';
        } else {
        	return $channelinfo;
        }

    	if (!empty($id_type) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1) {
        	$spdckey = self::$spdcprefix . '_' . md5($id) .'_'. $id_type;
        	$spdcval = get_transient($spdckey);
            if ( !empty($spdcval) ) {
                return $spdcval;
            }
        }

        if ( $id_type == "static_video" || $id_type == "static_list" ) {
	        if ( $id_type == "static_list" ) {
	            $apiEndpoint = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=' . urlencode($id) . '&maxResults=1&key=' . self::$alloptions[self::$opt_apikey];
	        } else {
	            $apiEndpoint = 'https://www.googleapis.com/youtube/v3/videos?id=' . urlencode($id) . '&part=snippet&key=' . self::$alloptions[self::$opt_apikey];
	        }
	        $apiResult = wp_remote_get($apiEndpoint, array('timeout' => self::$curltimeout));
	        if (!is_wp_error($apiResult)) {
	            $jsonResult = json_decode($apiResult['body']);
	            if (!isset($jsonResult->error) && isset($jsonResult->items) && $jsonResult->items != null && is_array($jsonResult->items)) {
	                $item = $jsonResult->items[0];
	                if ( isset($item->snippet->title) ) {
	                    $channelinfo->title = $item->snippet->title;
	                }
	                if ( isset($item->snippet->publishedAt) ) {
	                    $channelinfo->published = $item->snippet->publishedAt;
	                }
	                if ( isset($item->snippet->channelId) ) {
	                    $apiChannel = 'https://www.googleapis.com/youtube/v3/channels?part=brandingSettings,statistics,snippet&id=' . $item->snippet->channelId . '&key=' . self::$alloptions[self::$opt_apikey];
	                    $channelinfo->chnlid = $item->snippet->channelId;
	                }
	            }
	        }
	    } elseif ( $id_type == "static_channel" ) {
	    	$apiChannel = 'https://www.googleapis.com/youtube/v3/channels?part=brandingSettings,statistics,snippet&id=' . urlencode($id) . '&key=' . self::$alloptions[self::$opt_apikey];
	    }

	    if ( !empty($apiChannel) ) {
	    	$apiChResult = wp_remote_get($apiChannel, array('timeout' => self::$curltimeout));
	    	if (!is_wp_error($apiChResult)) {
	    		$jsonCResult = json_decode($apiChResult['body']);
	    		if (!isset($jsonCResult->error) && isset($jsonCResult->items) && $jsonCResult->items != null && is_array($jsonCResult->items)) {
		            $chitem = $jsonCResult->items[0];
		            if ( !isset($channelinfo->chnlid) && isset($chitem->id) ) {
		                $channelinfo->chnlid = $chitem->id;
		            }
		            if ( isset($chitem->snippet->title) ) {
		                if ( !isset( $channelinfo->title ) ) {
		                    $channelinfo->title = $chitem->snippet->title;
		                }
		                $channelinfo->name = $chitem->snippet->title;
		            }
		            if ( isset($chitem->brandingSettings->channel->description) ) {
		                $channelinfo->descInfo = $chitem->brandingSettings->channel->description;
		            }
		            if ( isset($chitem->snippet->publishedAt) ) {
		                $channelinfo->published = strtotime($chitem->snippet->publishedAt);
		            }
		            if ( isset($chitem->brandingSettings->image->bannerMobileImageUrl) ) {
		                $channelinfo->bannerImage = $chitem->brandingSettings->image->bannerMobileImageUrl;
		            }
		            if ( isset($chitem->snippet->thumbnails->default->url) ) {
		            	$channelinfo->thumbnail = $chitem->snippet->thumbnails->default->url;
                    }
		            if ( isset($chitem->statistics->viewCount) ) {
		                $channelinfo->viewCount = $chitem->statistics->viewCount;
		            }
		            if ( isset($chitem->statistics->subscriberCount) ) {
		                $channelinfo->subscriberCount = $chitem->statistics->subscriberCount;
		            }
		            if ( isset($chitem->statistics->videoCount) ) {
		                $channelinfo->videoCount = $chitem->statistics->videoCount;
		            }
		        }
		    }

		    if (!empty($channelinfo) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1 && !empty($spdckey)) {
            	$exp = self::$alloptions[self::$opt_spdcexp] * 60 * 60;
                set_transient($spdckey, $channelinfo, $exp);
            }
	    }
	    return $channelinfo;
	}

	/**
	 * Get youtube channel inforamtion
	 *
	 * @return string
	 */
    public static function get_channel_desc_social( $url ) {
        $url = wp_specialchars_decode(trim($url));
        $output = [];
        if ( !empty($url) ) {
        	$spdckey = $channelid = $id_type = $yid = '';
        	$has_channel = preg_match('/((http|https):\/\/|)(www\.|)youtube\.com\/channel\/([^"&?\/ ]{24})/', $url, $channel_arr);
        	if ( $has_channel ) {
        		if ( is_array($channel_arr) && isset($channel_arr[4]) && !empty($channel_arr[4]) ) {
        			$id_type = 'desc_channel';
        			$yid = $channelid = $channel_arr[4];
	        	}
	        } else {
				$linkparamstemp = explode('?', $url);
				$linkparams = [];
		        if (count($linkparamstemp) > 1){   
		            $ytvars = explode('&', $linkparamstemp[1]);
		            foreach ($ytvars as $k => $v){
		                $kvp = explode('=', $v);
		                if (count($kvp) == 2 && (true || strtolower($kvp[0]) != 'v')){
		                    $linkparams[$kvp[0]] = $kvp[1];
		                }
		            }
		        }
		        if (strpos($linkparamstemp[0], 'youtu.be') !== false && !isset($linkparams['v'])) {
		            $vtemp = explode('/', $linkparamstemp[0]);
		            $linkparams['v'] = array_pop($vtemp);
		        }
		        if ( isset($linkparams['v']) && !empty($linkparams['v']) ) {
		        	$id_type = 'desc_video';
		        	$yid = $linkparams['v'];
		        } else if ( isset($linkparams['list']) && !empty($linkparams['list']) ) {
		        	$id_type = 'desc_playlist';
		        	$yid = $linkparams['list'];
		        }
		    }

		    if ( empty($yid) ) {
		    	return $output;
		    }

	        if (!empty($id_type) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1) {
	        	$spdckey = self::$spdcprefix . '_' . md5($yid) .'_'. $id_type;
	        	$spdcval = get_transient($spdckey);
	            if ( !empty($spdcval) ) {
	                return $spdcval;
	            }
	        }

	        if ( $id_type == 'desc_video' || $id_type == 'desc_playlist' ) {
	        	if ( $id_type == 'desc_video' ) {
	        		$apiEndpoint = 'https://www.googleapis.com/youtube/v3/videos?id=' . urlencode($yid) . '&part=snippet&key=' . self::$alloptions[self::$opt_apikey];
	        	} else if ( $id_type == 'desc_playlist' ) {
	        		$apiEndpoint = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=' . urlencode($yid) . '&maxResults=1&key=' . self::$alloptions[self::$opt_apikey];
	        	}
        		$apiResult = wp_remote_get($apiEndpoint, array('timeout' => self::$curltimeout));
        		if (!is_wp_error($apiResult)) {
	                $jsonResult = json_decode($apiResult['body']);
	                if (!isset($jsonResult->error) && isset($jsonResult->items) && $jsonResult->items != null && is_array($jsonResult->items)) {
	                    $item = $jsonResult->items[0];
	                    if ( isset($item->snippet->channelId) ) {
	                        $channelid = $item->snippet->channelId;
	                    }
	                }
	            }
	        }

            if ( !empty($channelid) ) {
            	$ch = curl_init("https://www.youtube.com/channel/{$channelid}/about");
	            curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36');
	            curl_setopt($ch, CURLOPT_ENCODING, 'gzip');
	            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
	            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
	            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
	            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
	            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
	            $returns = curl_exec($ch); 
	            curl_close( $ch );
	            if ( !empty($returns) ) {
	                $description = ''; $output = $socials = [];
	                preg_match('/\,"primaryLinks":(\[(([^\]\[]+)|(?1))*+\])/s', $returns, $s_match);
	                preg_match('/"metadata":(\{(([^\}\{]+)|(?1))*+\})/s', $returns, $m_match);
	                if ( count($s_match) == 4 && isset($s_match[1]) && !empty($s_match[1]) ) {
	                	$social_object = @json_decode($s_match[1], true);
	                    if ( is_array($social_object) && !empty($social_object) ) {
	                    	foreach ($social_object as $social) {
	                    		if ( isset($social['navigationEndpoint']['commandMetadata']['webCommandMetadata']['url']) ) {
	                    			$plain_link = $social['navigationEndpoint']['commandMetadata']['webCommandMetadata']['url'];
	                    			wp_parse_str($plain_link, $qs);
	                    			$link = (isset($qs['q']) && !empty($qs['q'])) ? urldecode($qs['q']) : urldecode($plain_link) ;
                    				$img = isset($social['icon']['thumbnails']['0']['url']) ? $social['icon']['thumbnails']['0']['url'] : '' ;
                    				$title = isset($social['title']['simpleText']) ? $social['title']['simpleText'] : '' ;
	                    			$socials[] = ['link' => $link, 'img' => $img, 'title' => $title];
	                    		}
	                    	}
	                    }
	                    if ( !empty($socials) ) {
	                    	$output['social'] = $socials;
	                    }
	                }
	                if ( count($m_match) == 4 && isset($m_match[2]) && !empty($m_match[2]) ) {
	                	$meta_object = @json_decode($m_match[2], true);
	                    if ( is_array($meta_object) && isset($meta_object['description']) ) {
	                    	$output['desc'] = $meta_object['description'];
	                    }
	                }
	            }

                if (!empty($output) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1 && !empty($spdckey)) {
                	$exp = self::$alloptions[self::$opt_spdcexp] * 60 * 60;
                	set_transient($spdckey, $output, $exp);
                }
            }
		}
		return $output;
    }

    /**
	 * Get youtube channel latest playlist
	 *
	 * @return string
	 */
    public static function get_channel_latest_playlist( $yid ) {
    	$id = trim($yid);
        $id_type = "latest";
        $playlist = [];
        if ( strlen($id) == 24 ) {
        	if (self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1) {
	        	$spdckey = self::$spdcprefix . '_' . md5($id) .'_'. $id_type;
	        	$spdcval = get_transient($spdckey);
	            if ( !empty($spdcval) ) {
	                return $spdcval;
	            }
	        }

	        $apiChannel = 'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=' . urlencode($id) . '&key=' . self::$alloptions[self::$opt_apikey];

	        $apiChResult = wp_remote_get($apiChannel, array('timeout' => self::$curltimeout));
	    	if (!is_wp_error($apiChResult)) {
	    		$jsonCResult = json_decode($apiChResult['body']);
	    		if (!isset($jsonCResult->error) && isset($jsonCResult->items) && $jsonCResult->items != null && is_array($jsonCResult->items)) {
	    			$channel = $jsonCResult->items[0];
	    			if ( !empty($channel) && isset($channel->contentDetails->relatedPlaylists->uploads) ) {
	    				$id = $channel->contentDetails->relatedPlaylists->uploads;
	    				$title = __("Latest Videos: Select another playlist here", "yfetch");
		    			$playlist[] = ['id' => $id, 'title' => $title];
		    			if (!empty($playlist) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1 && !empty($spdckey)) {
				        	$exp = self::$alloptions[self::$opt_spdcexp] * 60 * 60;
				        	set_transient($spdckey, $playlist, $exp);
				        }
				    }
			    }
		    }
	    }
        return $playlist;
    }

	/**
	 * Get youtube channel all playlist
	 *
	 * @return string
	 */
    public static function get_channel_all_playlist( $yid ) {
    	$id = trim($yid);
        $id_type = "playlist";
        $list = [];
        if ( strlen($id) == 24 ) {
        	if (self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1) {
	        	$spdckey = self::$spdcprefix . '_' . md5($id) .'_'. $id_type;
	        	$spdcval = get_transient($spdckey);
	            if ( !empty($spdcval) ) {
	                return $spdcval;
	            }
	        }

	        $apiChannel = 'https://www.googleapis.com/youtube/v3/playlists?channelId=' . urlencode($id) . '&maxResults=50&part=snippet,status&key=' . self::$alloptions[self::$opt_apikey];

	        $apiChResult = wp_remote_get($apiChannel, array('timeout' => self::$curltimeout));
	    	if (!is_wp_error($apiChResult)) {
	    		$jsonCResult = json_decode($apiChResult['body']);
	    		if (!isset($jsonCResult->error) && isset($jsonCResult->items) && $jsonCResult->items != null && is_array($jsonCResult->items)) {
		           	$playlists = $jsonCResult->items;
		           	foreach ($playlists as $playlist) {
		           		$data = [];
		           		if ( isset($playlist->status->privacyStatus) ) {
		           			if ($playlist->status->privacyStatus == "public") {
		           				if ( isset($playlist->id) ) {
		           					$data['id'] = $playlist->id;
			           				if ( isset($playlist->snippet->title) ) {
			           					$data['title'] = $playlist->snippet->title;
			           				} else {
			           					$data['title'] = __("Unknown", "yfetch");
			           				}
			           			}
		           			}
		           		} else {
		           			if ( isset($playlist->id) ) {
	           					$data['id'] = $playlist->id;
		           				if ( isset($playlist->snippet->title) ) {
		           					$data['title'] = $playlist->snippet->title;
		           				} else {
		           					$data['title'] = __("Unknown", "yfetch");
		           				}
		           			}
		           		}
		           		if ( !empty($data) ) {
		           			$list[] = $data;
		           		}
		           	}

		           	if (!empty($list) && self::$alloptions[self::$opt_pro] && strlen(trim(self::$alloptions[self::$opt_pro])) > 9 && self::$alloptions[self::$opt_spdc] == 1 && !empty($spdckey)) {
			        	$exp = self::$alloptions[self::$opt_spdcexp] * 60 * 60;
			        	set_transient($spdckey, $list, $exp);
			        }
		        }
		    }
		}
        return $list;
	}

	/**
	 * Output main block
	 *
	 * @return string
	 */
    public static function yf_main_block( $channelblocks, $key, $postid ) {
    	ob_start(); 
    	if ( is_array($channelblocks) && !empty($channelblocks) ) {
	    	echo '<div class="yf-fetch-content" data-id="'.$key.'" post-id="'.$postid.'">';
	    	foreach ($channelblocks as $innerblock) {
				$shortocde = $innerblock['innerHTML'];
				if ( preg_match( self::$scoderegex, $shortocde, $matches ) && isset($matches[2], $matches[5]) && $matches[2] === 'embedyt' && !empty(trim($matches[5])) ) {
					$s_content = trim($matches[5]);
					if ( preg_match(self::$justurlregex, $s_content) ) {
	        			$link = trim(str_replace(self::$badentities, self::$goodliterals, $s_content));
	        			$link = preg_replace('/\s/', '', $link);
	        			$linkparamstemp = explode('?', $link);

	        			$linkparams = [];
				        if (count($linkparamstemp) > 1){   
				            $ytvars = explode('&', $linkparamstemp[1]);
				            foreach ($ytvars as $k => $v){
				                $kvp = explode('=', $v);
				                if (count($kvp) == 2 && (true || strtolower($kvp[0]) != 'v')){
				                    $linkparams[$kvp[0]] = $kvp[1];
				                }
				            }
				        }

				        $chdata = new stdClass();
			            $titledata = __("Youtube Player", "yfetch");
			            $datainfo = $descInfo = $chnlid = $chnlname = '';
			            $published = current_time('timestamp');
			            $subscriberCount = $viewCount = $videoCount = 0;
			            $bannerImage = Yfetch::instance()->assets_url."images/youtube-banner.png";
			            $channelurl = isset($innerblock['attrs']['channelLink']) ? trim($innerblock['attrs']['channelLink']) : home_url() ;

				        if (isset($linkparams['v'])) {
			                $chdata = self::get_channel_statics($linkparams['v']);
			            } else if (isset($linkparams['channel'])) {
			                $chdata = self::get_channel_statics($linkparams['channel'], "channel");
			            } else if (isset($linkparams['list'])) {
			                $chdata = self::get_channel_statics($linkparams['list'], "playlist");
			            }

			            if ( !empty($chdata) ) {
			                if ( isset($chdata->name) ) {
			                    $chnlname = $chdata->name;
			                } 
			                if ( isset($chdata->chnlid) ) {
			                    $chnlid = $chdata->chnlid;
			                } 
			                if ( isset($chdata->title) ) {
			                    $titledata = wp_trim_words($chdata->title, 6, '');
			                } 
			                if ( isset($chdata->descInfo) ) {
			                    $descInfo = $chdata->descInfo;
			                } 
			                if ( isset($chdata->published) ) {
			                    $published = $chdata->published;
			                } 
			                if ( isset($chdata->bannerImage) ) {
			                    $bannerImage = $chdata->bannerImage;
			                } 
			                if ( isset($chdata->subscriberCount) ) {
			                    $subscriberCount = $chdata->subscriberCount;
			                } 
			                if ( isset($chdata->viewCount) ) {
			                    $viewCount = $chdata->viewCount;
			                }
			                if ( isset($chdata->videoCount) ) {
			                    $videoCount = $chdata->videoCount;
			                }
			            }

			            $datainfo = ' data-view="'.$viewCount.'"';
			            $datainfo .= ' data-video="'.$videoCount.'"' ;
			            $datainfo .= ' data-subscriber="'.$subscriberCount.'"';
			            $datainfo .= ' data-title="'.$chnlname.'"';
			            $datainfo .= ' data-date="'.$published.'"';

			            if ( isset($innerblock['attrs']['description']) && !empty($innerblock['attrs']['description']) ) {
			            	$descInfo = urldecode($innerblock['attrs']['description']);
			            }

			            $sdescInfo = wp_trim_words($descInfo, 22, ' ...');
			            $pieces = explode(' ', $sdescInfo);
			            $excerpts = (array_pop($pieces) == '...') ? '<span class="yf-desc-more">'.__("Read More", "yfetch").'</span>' : '' ; ?>

			            <div class="yfetch-items" <?php echo $datainfo; ?>>
			            	<div class="yfetch-row">
			            		<img src="<?php echo $bannerImage; ?>" alt="<?php echo $chnlname; ?>" class="yf-banner-mbl">
			            		<div class="yf-video-content">
			            			<div class="epyt-video-wrapper">
			            				<?php if ( class_exists('YouTubePrefsPro') && method_exists('YouTubePrefsPro', 'apply_prefs_shortcode') ) {
				            				echo YouTubePrefsPro::apply_prefs_shortcode("", $s_content);
				            			} else {
				            				_e("Yfetch pro's JavaScript requires &quot;Embed Plus for YouTube Pro&quot;", "yfetch");
				            			} ?>
				            		</div>
			            		</div>
			            		<div class="yfetch-channel">
					            	<a href="<?php echo $channelurl; ?>" title="<?php echo $chnlname; ?>" target="_blank">
					            		<img src="<?php echo $bannerImage; ?>" alt="" class="yf-channel-banner">
					            	</a>
				            		<table class="yf-add-info" width="100%">
				            			<thead>
					            			<tr>
					            				<th><?php _e("Views", "yfetch"); ?></th>
					            				<th><?php _e("Videos", "yfetch"); ?></th>
					            				<th><?php _e("Subscribers", "yfetch"); ?></th>
					            				<th><?php _e("Started", "yfetch"); ?></th>
					            			</tr>
					            		</thead>
					            		<tbody>
					            			<tr>
					            				<td><?php self::number_format_short($viewCount); ?></td>
					            				<td><?php echo $videoCount; ?></td>
					            				<td><?php self::number_format_short($subscriberCount); ?></td>
					            				<td><?php echo date( 'M j, Y', $published ); ?></td>
					            			</tr>
					            		</tbody>
					            	</table>
					            	<div class="yf-desc-block">
					            		<div class="yf-desc-text" style="display: none;"><?php echo nl2br($descInfo); ?></div>
					            		<p class="yt-desc"><span class="yf-desc-excerpt"><?php echo $sdescInfo; ?></span><?php echo $excerpts; ?><br/><a href="<?php echo $channelurl; ?>" title="<?php echo $chnlname; ?>" target="_blank"><?php printf( __("Visit %s &raquo;", "yfetch"), $chnlname ) ; ?></a></p>
					            	</div>
					            </div>
			            	</div>
			            </div>

			        <?php } else {
			        	echo '<em>Channel previous is not available</em>';
			        }
			    }
			}
			echo '</div>';
		}
		return ob_get_clean();
    }

    /**
     * Render related block
     *
     * @return string
     */
    public static function related_channel_callback($attributes, $content) {
    	if ( isset($attributes['shortcode'], $attributes['channelLink']) ) {
    		$attributes['shortcode'] = str_replace('[yf_rel]', '[yf_rel channelLink="'.$attributes['channelLink'].'"]', $attributes['shortcode']);
    	}
    	return isset($attributes['shortcode']) ? do_shortcode($attributes['shortcode']) : "";
    }
}

Yfetch_functions::instance();