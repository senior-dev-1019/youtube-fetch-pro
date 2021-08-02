<?php if ( ! defined( 'ABSPATH' ) )
	exit;

/**
 * Hooks
 */
class Yfetch_hook {

	protected static $instance = null;

	public static function instance() {
		return null == self::$instance ? new self : self::$instance;
	}

	public function __construct() {
		add_action( 'wp_ajax_nopriv_yfetch_is_valid_yid', array( $this, 'yfetch_is_valid_yid' ) );
		add_action( 'wp_ajax_yfetch_is_valid_yid', array( $this, 'yfetch_is_valid_yid' ) );
		add_action( 'wp_ajax_nopriv_yfetch_channel_addinfo', array( $this, 'yfetch_channel_addinfo' ) );
		add_action( 'wp_ajax_yfetch_channel_addinfo', array( $this, 'yfetch_channel_addinfo' ) );
		add_action( 'wp_ajax_nopriv_yfetch_search_faq', array( $this, 'yfetch_search_faq' ) );
		add_action( 'wp_ajax_yfetch_search_faq', array( $this, 'yfetch_search_faq' ) );
		add_action( 'wp_ajax_nopriv_yfetch_load_faq', array( $this, 'yfetch_load_faq' ) );
		add_action( 'wp_ajax_yfetch_load_faq', array( $this, 'yfetch_load_faq' ) );
		add_action( 'wp_ajax_nopriv_yfetch_load_playlist', array( $this, 'yfetch_load_playlist' ) );
		add_action( 'wp_ajax_yfetch_load_playlist', array( $this, 'yfetch_load_playlist' ) );
		add_action( 'wp_ajax_nopriv_yfetch_load_main', array( $this, 'yfetch_load_main' ) );
		add_action( 'wp_ajax_yfetch_load_main', array( $this, 'yfetch_load_main' ) );
		add_action( 'admin_head-edit.php', array( $this, 'pretty_title_faq' ) );
		add_shortcode( 'yfetch_faq', array( $this, 'yfetch_view_faq' ) );
		add_shortcode( 'yf_rel', array( $this, 'yfetch_relative' ) );
	}

	/**
	 * Ajax - check if id is valid channgel id/ video id
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_is_valid_yid() {
		if (isset($_POST['id'])) {
			$result = !empty(Yfetch_functions::is_valid_yid($_POST['id'])) ? Yfetch_functions::is_valid_yid($_POST['id']) : [] ;
			echo json_encode($result);
		} else {
			echo json_encode([]);
		}
		wp_die();
	}

	/**
	 * Ajax - get channel description & social links
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_channel_addinfo() {
		if (isset($_POST['url'])) {
			$result = !empty(Yfetch_functions::get_channel_desc_social($_POST['url'])) ? Yfetch_functions::get_channel_desc_social($_POST['url']) : [] ;
			echo json_encode($result);
		} else {
			echo json_encode([]);
		}
		wp_die();
	}

	/**
	 * Ajax - search faq
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_search_faq() {
		if (isset($_POST['s'])) {
			$output = [];
			$args = array(
    			'post_type' => 'yfaq',
    			'posts_per_page' => apply_filters('yfetch_faq_per_page', 5),
    			's' => trim($_POST['s']),
    			'orderby' => 'relevance'
    		);
    		$query = new WP_Query($args);
    		$posts = $query->get_posts();
    		if ( !empty($posts) ) {
    			$arr = isset($_POST['exist']) ? @json_decode(stripslashes($_POST['exist']),true) : [] ;
    			foreach ($posts as $post) {
    				$exist = (is_array($arr) && in_array($post->ID, $arr)) ? 'true' : 'false' ;
    				$output[] = ['id' => $post->ID, 'title' => $post->post_title, 'exist' => $exist];
    			}
    		}
    		echo json_encode($output);
		} else {
			echo json_encode([]);
		}
		wp_die();
	}

	/**
	 * Ajax - load faqs
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_load_faq() {
		$output = "";
		if (isset($_POST['faqs'])) {
			$arr = @json_decode(stripslashes($_POST['faqs']),true);
			if (is_array($arr) && !empty($arr)) {
				ob_start();
				$args = array ( 
					'post_type'      => 'yfaq',
					'post__in'		=> $arr,
					'orderby'        => 'post__in', 
					'order'          => 'DESC',
					'posts_per_page' => -1,           
				);      
				$query = new WP_Query($args);
				if ( $query->have_posts() ){ ?>
					<div class="yfaq-accordion" data-accordion-group>	
						<?php while ($query->have_posts()) : $query->the_post(); ?>			  
							<div data-accordion class="faq-main">
								<div data-control class="faq-title"><h4><?php the_title(); ?></h4></div>
								<div data-content>
									<div class="faq-content"><?php the_content(); ?></div>
								</div>
							</div>
						<?php endwhile; ?>
					</div>
				<?php }
				wp_reset_postdata(); ?>
				<script type="text/javascript">
					jQuery(document).ready(function() {
						jQuery('.yfaq-accordion [data-accordion]').accordionfaq({
							singleOpen: true,
							transitionEasing: 'ease',
							transitionSpeed: 300
						});        
					});
				</script> 
				<?php $output = ob_get_clean();
			}
		}
		echo $output;
		wp_die();
	}

	/**
	 * Ajax - load playlist
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_load_playlist() {
		$output = "";
		if (isset($_POST['channelid'])) {
			$active = 0;
			$playlistid = (isset($_POST['playlistid']) && !empty($_POST['playlistid'])) ? trim($_POST['playlistid']) : 0 ;
			$latest = Yfetch_functions::get_channel_latest_playlist($_POST['channelid']);
			$alllist = Yfetch_functions::get_channel_all_playlist($_POST['channelid']);

			if ( !empty($latest) && !empty($alllist) ) {
				$playlists = array_merge($latest, $alllist);
			} else if ( !empty($latest) && empty($alllist) ) {
				$playlists = $latest;
			} else if ( empty($latest) && !empty($alllist) ) {
				$playlists = $alllist;
			} else {
				$playlists = [];
			}

			if ( !empty($playlists) ) {
				$singlelist = $playlists[0];
				$has_prev = $has_next = "";
				$select = '<select class="yf_list_select" name="yf_view_sel" data-id="'.$_POST['channelid'].'">';
				foreach ($playlists as $key => $playlist) {
					$is_selected = "";
					if ($playlistid === $playlist['id'] || $playlistid == $key) {
						$singlelist = $playlist;
						$is_selected = 'selected="selected"';
						$active = $key;
					}
					$select .= '<option value="'.$playlist['id'].'" '.$is_selected.'>'.$playlist['title'].'</option>';
				} $select .= '</select>';

				if ( count($playlists) == 1 ) {
					$has_prev = $has_next = 'disabled';
				} else {
					if ( $active == 0 ) {
						$has_prev = 'disabled';
					} else if ( count($playlists)-1 == $active ) {
						$has_next = 'disabled';
					}
				}
				ob_start(); ?>
				<div class="yf_view">
					<div class="yf_view_head">
						<div class="yf_view_pagi">
							<span class="yf_view_btn prev <?php echo $has_prev; ?>"><a href="#prev"><?php _e("Previous", "yfetch"); ?></a></span>
							<p class="yf_select_list"><?php echo $select; ?></p>
							<span class="yf_view_btn next <?php echo $has_next; ?>"><a href="#next"><?php _e("Next", "yfetch"); ?></a></span>
						</div>
					</div>
					<div class="yf_view_body">
						<?php if ( class_exists('YouTubePrefsPro') && method_exists('YouTubePrefsPro', 'apply_prefs_shortcode') ) {
							echo YouTubePrefsPro::apply_prefs_shortcode("", "https://www.youtube.com/embed?listType=playlist&list=".$singlelist['id']."&layout=gallery");
						} else {
							_e("Yfetch pro's JavaScript requires &quot;Embed Plus for YouTube Pro&quot;", "yfetch");
						} ?>
					</div>
				</div> 
				<?php $output = ob_get_clean();
			}
		}
		echo $output;
		die();
	}

	/**
	 * Ajax - load main section
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_load_main() {
		$output = '<div class="yf-fetch-content"><p class="yf-item-none">'.__("Sorry, No more channel found.", "yfetch").'</p></div>';
		if (isset($_POST['key'], $_POST['id'], $_POST['paged']) && !empty($_POST['key']) && !empty($_POST['id']) && !empty($_POST['paged'])) {

			$key = $_POST['key'];
			$postid = $_POST['id'];
			$paged = (int) $_POST['paged'];
			$perpage = isset($_POST['item']) ? (int) $_POST['item'] : 10 ;
			$blockContent = get_post_meta($postid, $key, true);
			if ( is_array($blockContent) && !empty($blockContent) ) {
				$total = count($blockContent);
				$channelblocks = array_slice($blockContent, (($perpage*$paged)-$perpage), $perpage);
				if ( !empty($channelblocks) ) {
					$output = Yfetch_functions::yf_main_block($channelblocks, $key, $postid);
		    		if ( $paged == 1 && ceil($total/$perpage) > 1 ) {
						$pagination = '<div class="yf-paginate">'
			    			. '<span>&nbsp;&nbsp;&nbsp;1&nbsp;/&nbsp;'.ceil($total/$perpage).'&nbsp;&nbsp;&nbsp;</span>'
			    			. '<a href="#" data-paged="2">'.__("Next, More Channel »", "yfetch").'</a>'
			    			. '</div>';
		    		} else if ( $paged > 1 && ceil($total/$perpage) > $paged ) {
		    			$pagination = '<div class="yf-paginate">'
			    			. '<a href="#" data-paged="'.($paged-1).'">« Prev</a>'
			    			. '<span>&nbsp;&nbsp;&nbsp;'.$paged.'&nbsp;/&nbsp;'.ceil($total/$perpage).'&nbsp;&nbsp;&nbsp;</span>'
			    			. '<a href="javascript:void(0)" data-paged="'.($paged+1).'">'.__("Next, More Channel »", "yfetch").'</a>'
			    			. '</div>';
		    		} else if ( $paged > 1 && ceil($total/$perpage) <= $paged ) {
		    			$pagination = '<div class="yf-paginate">'
			    			. '<a href="#" data-paged="'.($paged-1).'">'.__("« Prev", "yfetch").'</a>'
			    			. '<span>&nbsp;&nbsp;&nbsp;'.$paged.'&nbsp;/&nbsp;'.ceil($total/$perpage).'</span>'
			    			. '</div>';
		    		} else {
		    			$pagination = "";
		    		}
		    		$output .= $pagination;
		    	}
			}
		}
		echo $output;
		die();
	}

	/**
	 * Change title in faq
	 *
	 * @param string $hook Hook parameter.
	 */
	public function pretty_title_faq() {
		add_filter('the_title', function ( $title, $id ) {
			if ( get_post_type($id) == 'yfaq' ) {
				return $title . ' (#'.$id.')';
			} else {
				return $title;
			}
		}, 100, 2 );
	}

	/**
	 * Shortcode - view faqs
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_view_faq( $atts, $content = null ) {
		extract(shortcode_atts(array(
			"include" => '',
		), $atts));
		ob_start();

		if( $include ) {
			$include = preg_replace("/\s+/", "", $include);
			$args = array(
				'post_type'		=> 'yfaq',
				'order'			=> 'DESC',
				'post__in'		=> explode(',', trim($include)),
				'orderby'		=> 'post__in'
			);      
			$query = new WP_Query($args);
			$post_count = $query->post_count;
			$i = 1;
			if( $post_count > 0) { ?>
				<div class="yfaq-accordion" data-accordion-group>	
					<?php while ($query->have_posts()) : $query->the_post(); ?>			  
						<div data-accordion class="faq-main">
							<div data-control class="faq-title"><h4> <?php the_title(); ?></h4></div>
							<div data-content>
								<div class="faq-content"><?php the_content(); ?></div>
							</div>
						</div>
					<?php $i++;
					endwhile; ?>
				</div>
			<?php }
			wp_reset_postdata(); ?>

			<script type="text/javascript">
				jQuery(document).ready(function() {
					jQuery('.yfaq-accordion [data-accordion]').accordionfaq({
						singleOpen: true,
						transitionEasing: 'ease',
						transitionSpeed: 300
					});        
				});
			</script>

		<?php }
		return ob_get_clean();
	}

	/**
	 * Shortcode - channel table
	 *
	 * @param string $hook Hook parameter.
	 * @return json
	 */
	public function yfetch_relative( $atts, $content = null ) {
		$values = shortcode_atts( array(
	        'channellink' => home_url('/')
	    ), $atts );
		ob_start(); ?>
		<div class="yf-rel-block">
			<table class="yf-table" cellspacing="0" width="100%">
				<thead><tr>
					<th><?php _e("Channel", "yfetch"); ?></th>
					<th><?php _e("Total Views", "yfetch"); ?></th>
					<th><?php _e("Total Subscribers", "yfetch"); ?></th>
					<th><?php _e("Total Videos", "yfetch"); ?></th>
					<th><?php _e("Date Started", "yfetch"); ?></th>
				</tr></thead>
				<tbody><tr class="yf_tr">
					<?php 
					$s_content = trim($content);
					$channelregex = '@https?://(?:www\.)?youtu((\.be)|(be\..{2,5}))\/channel\/([^"&?\/ ]{24})@i';
        			preg_match($channelregex, $s_content, $cmatches);
        			if ( is_array($cmatches) && isset($cmatches[4]) && !empty($cmatches[4]) ) {
        				$chdata = Yfetch_functions::get_channel_statics($cmatches[4], "channel");
        				if ( !empty($chdata) ) {
		        			$channel = isset($values['channellink']) ? trim($values['channellink']) : home_url('/') ;
		        			$desc = isset($innerblock['attrs']['description']) ? htmlentities(trim($innerblock['attrs']['description'])) : '' ;
		        			if (isset($innerblock['attrs']['socialInfo']) && !empty($innerblock['attrs']['socialInfo']) && is_array($innerblock['attrs']['socialInfo'])) {
		        				$socials = $innerblock['attrs']['socialInfo'];
		        				$scontent = '<div class="link"><span class="yf_load yf_social" data-target=".social_window">'.__("Links", "yfetch").'</span><div class="social_window" style="display: none">';
		        				foreach ($socials as $key => $social) {
		        					if ( $key == 0 ) {
		        						$scontent .= '<a href="'.$social['link'].'" title="'.$social['title'].'" target="_blank"><img src="'.$social['img'].'" height="16" width="16"><span>'.$social['title'].'</span></a>';
		        					} else {
		        						$scontent .= '<a href="'.$social['link'].'" title="'.$social['title'].'" target="_blank"><img src="'.$social['img'].'" height="16" width="16"></a>';
		        					}
		        				}
		        				$scontent .= '</div></div>';
		        			} else {
		        				$scontent = "";
		        			}
		        			$name = isset($chdata->title) ? $chdata->title : __("Yfetch", "yfetch") ;
		        			$thumbnail = isset($chdata->thumbnail) ? $chdata->thumbnail : Yfetch::instance()->assets_url.'images/thumbnail.png' ;
		        			$views = isset($chdata->viewCount) ? $chdata->viewCount : __("Unknown", "yfetch") ;
		        			$subscribers = isset($chdata->subscriberCount) ? $chdata->subscriberCount : __("Unknown", "yfetch") ;
		        			$videos = isset($chdata->videoCount) ? $chdata->videoCount : __("Unknown", "yfetch") ;
		        			$published = isset($chdata->published) ? date('M j, Y', $chdata->published) : date('M j, Y', current_time('timestamp')) ; ?>
		        			<td data-search="<?php echo $name; ?>">
		        				<div class="name yf_thumb">
		        					<a href="<?php echo $channel; ?>" title="<?php echo $name; ?>"><img class="thumbnail" src="<?php echo $thumbnail; ?>"><span class="yf_channel"><?php echo $name; ?></span></a>
		        				</div>
		        			</td>
		        			<td data-search="<?php echo $views; ?>" data-sort="<?php echo $views; ?>">
		        				<div class="name"><?php echo Yfetch_functions::number_format_short($views); ?></div>
		        				<?php if ( !empty($desc) ) { ?>
		        				<div class="link">
		        					<span class="yf_load yf_desc" data-desc="<?php echo $desc; ?>"><?php _e("Description", "yfetch"); ?></span>
		        				</div>
		        			<?php } ?>
		        			</td>
		        			<td data-search="<?php echo $subscribers; ?>" data-sort="<?php echo $subscribers; ?>">
		        				<div class="name"><?php echo Yfetch_functions::number_format_short($subscribers); ?></div>
		        				<div class="link">
		        					<span class="yf_load yf_view" data-id="<?php echo $cmatches[4]; ?>"><?php _e("View all Videos", "yfetch"); ?></span>
		        				</div>
		        			</td>
		        			<td data-search="<?php echo $videos; ?>" data-sort="<?php echo $videos; ?>">
		        				<div class="name"><?php echo $videos; ?></div><?php echo $scontent; ?>
		        			</td>
		        			<td data-search="<?php echo $published; ?>" data-sort="<?php echo strtotime($published); ?>">
		        				<div class="name"><?php echo $published; ?></div>
		        				<?php if ( !empty($channel) ) { ?>
		        					<div class="link">
		        						<a class="yf_load" href="<?php echo $channel; ?>"><?php _e("Visit >>", "yfetch"); ?></a>
		        					</div>
		        				<?php } ?>
		        			</td>
		        		<?php }
			        } else { ?>
			        	<td colspan="5" valign="top"><?php _e("No records found", "yfetch"); ?></td>
			        <?php } ?>
				</tr></tbody>
			</table>
		</div>
		<?php return ob_get_clean();
	}
}

Yfetch_hook::instance();