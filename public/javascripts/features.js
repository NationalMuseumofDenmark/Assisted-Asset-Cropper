(function($) {
	// Extending with a method to serialize a form to an object.
	$.fn.serializeObject = function()
	{
		var o = {};
		var a = this.serializeArray();
		$.each(a, function() {
				if (o[this.name] !== undefined) {
						if (!o[this.name].push) {
								o[this.name] = [o[this.name]];
						}
						o[this.name].push(this.value || '');
				} else {
						o[this.name] = this.value || '';
				}
		});
		return o;
	};

	// On document ready
	$(function() {
		
		// First user story ..
		$("#crop-form").submit(function(e) {
			e.preventDefault();
			var params = $(e.target).serializeObject();
			var url = location.origin + "/asset/" +
				params.catalog + "/" +
				params.asset_id + "/crop/" +
				params.left + ":" +
				params.top + ":" +
				params.width + ":" +
				params.height + "/" +
				params.size;
			var $link = $("<a>")
				.attr('href', url)
				.attr('target', '_blank')
				.text(url);
			var $img = $("<img>")
				.attr('src', url + "/stream");
			// Insert it into the dom.
			$(".result", e.target)
				.find('.link').empty().append($link).end()
				.find('.image').empty().append($img).end();
		});

		// Second user story
		$("#single-suggestion-cropped-form").submit(function(e) {
			e.preventDefault();
			var params = $(e.target).serializeObject();
			var suggestions_url = location.origin + "/asset/" +
				params.catalog + "/" +
				params.asset_id + "/suggestions/" +
				params.size;

			var $suggestions_link = $("<a>")
				.attr('href', suggestions_url)
				.attr('target', '_blank')
				.text(suggestions_url);

			$.get(suggestions_url, function(suggestions) {
				var suggestions_string = JSON.stringify(suggestions, null, " ");
				// Insert it into the dom.
				$(".suggestions-result", e.target)
					.find('.link').empty().append($suggestions_link).end()
					.find('.response').empty().text(suggestions_string).end();

				var $crop_link = $("<em>").text("...");
				var $crop_image = $("<em>").text("...");

				if(suggestions.length > 0 && suggestions.error === undefined) {
					var s = suggestions[0];
					var $crop_link = $("<a>")
						.attr('href', location.origin + s.thumbnail_url)
						.attr('target', '_blank')
						.text(location.origin + s.thumbnail_url);
					var $crop_image = $("<img>")
						.attr('src', location.origin + s.thumbnail_url);
				}

				$(".cropped-result", e.target)
					.find('.link').empty().append($crop_link).end()
					.find('.image').empty().append($crop_image).end();
			});
		});

		// Third user story
		$("#single-suggestion-select-form").submit(function(e) {
			e.preventDefault();
			var params = $(e.target).serializeObject();
			var thumbnail_url = location.origin + "/asset/" +
				params.catalog + "/" +
				params.asset_id + "/thumbnail/" +
				params.size + "/stream";
			var suggestions_url = location.origin + "/asset/" +
				params.catalog + "/" +
				params.asset_id + "/suggestions/" +
				params.size;

			$.get(suggestions_url, function(suggestions) {

				if(suggestions.length > 0 && suggestions.error === undefined) {
					var s = suggestions[0];
					var coordinates = {
						x1: s.left,
						y1: s.top,
						x2: s.left + s.width,
						y2: s.top + s.height
					};
					$image = $(".result img", e.target);
					$image.load(function() {
						var width = $(this).width();
						var height = $(this).height();
						coordinates.x1 *= width;
						coordinates.x2 *= width;
						coordinates.y1 *= height;
						coordinates.y2 *= height;
						var params = coordinates;
						params.instance = true;
						var area_select = $(this).imgAreaSelect( params );
						$(this).data('area_selection', area_select);
					}).attr('src', thumbnail_url);
					var area_selection = $image.data('area_selection');
					area_selection.hide();
				}

			});
		});

		$(".download-btn").click(function(e) {
			var $form = $(this).closest('form');
			var $image = $form.find('.result img');
			var area_selection = $image.data('area_selection');
			if(area_selection) {
				var selection = area_selection.getSelection();
				var params = {
					catalog: $form.find('input[name=catalog]').val(),
					asset_id: $form.find('input[name=asset_id]').val(),
					left: selection.x1 / $image.width(),
					top: selection.y1 / $image.height(),
					width: selection.width / $image.width(),
					height: selection.height / $image.height()
				};
				var url = location.origin + "/asset/" +
					params.catalog + "/" +
					params.asset_id + "/crop/" +
					params.left + ":" +
					params.top + ":" +
					params.width + ":" +
					params.height + "/" +
					'maximal/download';
				window.open(url);
			}
		});
	});
})(jQuery);