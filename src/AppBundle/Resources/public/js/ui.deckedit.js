(function ui_deck(ui, $) {

var DisplayColumnsTpl = '',
	SortKey = 'type_code',
	SortOrder = 1,
	CardDivs = [[],[],[]],
	Format = null,
	Config = null;

Handlebars.registerHelper('restricted', function(code) {
	return _.includes(app.deck.get_format_data().data.restricted, code);
});	

Handlebars.registerHelper('erratad', function(code) {
	return _.includes(app.deck.get_format_data().data.errata, code);
});	

/**
 * reads ui configuration from localStorage
 * @memberOf ui
 */
ui.read_config_from_storage = function read_config_from_storage() {
	if (localStorage) {
		var stored = localStorage.getItem('ui.deck.config');
		if(stored) {
			Config = JSON.parse(stored);
		}
	}
	Config = _.extend({
		'show-unusable': false,
		'show-only-deck': false,
		'show-only-owned': true,
		'buttons-behavior': 'cumulative'
	}, Config || {});
}

/**
 * write ui configuration to localStorage
 * @memberOf ui
 */
ui.write_config_to_storage = function write_config_to_storage() {
	if (localStorage) {
		localStorage.setItem('ui.deck.config', JSON.stringify(Config));
	}
}

/**
 * inits the state of config buttons
 * @memberOf ui
 */
ui.init_config_buttons = function init_config_buttons() {
	// radio
	['core-set', 'buttons-behavior'].forEach(function (radio) {
		$('input[name='+radio+'][value='+Config[radio]+']').prop('checked', true);
	});
	// checkbox
	['show-unusable', 'show-only-deck', 'show-only-owned'].forEach(function (checkbox) {
		if(Config[checkbox]) $('input[name='+checkbox+']').prop('checked', true);
	})
}

ui.on_collection_loaded = function on_collection_loaded() {
	ui.sum_reprints_owned();
	ui.set_max_qty();
}

/**
 * sets the maxqty of each card
 * @memberOf ui
 */
ui.set_max_qty = function set_max_qty() {
	app.data.cards.find().forEach(function(record) {
		var max_value = record.deck_limit || 2;
		if(record.type_code=='character' && !record.is_unique) {
			max_value = Math.min(parseInt(30 / parseInt(record.points, 10)));
		} else if (app.deck.is_included('08143') && _.includes(['upgrade', 'downgrade', 'support', 'event'], record.type_code)) {
			max_value++;
		}  else if (app.deck.is_included('09114') && record.type_code==='event' && _.map(record.subtypes, 'code').includes('move')) {
			max_value++;
		}

		var max_qty = {
			cards: max_value,
			dice: record.has_die ? max_value : 0
		}

		if(record.type_code=='character') {
			max_qty.dice = record.points.split('/').length;
		}

		if(Config['show-only-owned']) {
			var owned = app.collection.get_copies_owned(record.code);
			max_qty.cards = Math.min(max_qty.cards, owned.cards);
			max_qty.dice = Math.min(max_qty.dice, owned.dice);
		}

		app.data.cards.updateById(record.code, {
			maxqty : max_qty
		});
	});
}

ui.sum_reprints_owned = function sum_reprints_owned() {
	app.data.cards.find({reprint_of: {$exists: true}}).forEach(function(card) {
		var cardReprinted = app.data.cards.findById(card.reprint_of);
		app.data.cards.updateById(card.reprint_of, {
			owned: {
				cards: cardReprinted.owned.cards + card.owned.cards,
				dice: cardReprinted.owned.dice + card.owned.dice
			}
		});
	});
}

function get_examples(codes, key) {
	return _.map(codes, function(code) {
		var query={}; query[key] = code;
		return {code: code, example: app.data.cards.find(query)[0] };
	});	
}

/**
 * builds the format selector
 * @memberOf ui
 */
ui.build_format_selector = function build_format_selector() {
	$('#format-selector').empty();
	var tpl = Handlebars.templates['ui_deckedit-formats'];
	$('#format-selector').html(tpl({
		formats: app.data.formats.find({name: {'$exists': true } }, {})
	})).button().find('label').tooltip({container: 'body', html: true});
}

/**
 * builds the affiliation selector
 * @memberOf ui
 */
ui.build_affiliation_selector = function build_affiliation_selector() {
	$('[data-filter=affiliation_code]').empty();
	var tpl = Handlebars.templates['ui_deckedit-affiliations'];
	var affiliation_codes = app.data.cards.distinct('affiliation_code').sort();
	var neutral_index = affiliation_codes.indexOf('neutral');
	affiliation_codes.splice(neutral_index, 1);
	affiliation_codes.unshift('neutral');
	$('[data-filter=affiliation_code]').html(
		tpl({codes: get_examples(affiliation_codes, 'affiliation_code')})
	).button().find('label').tooltip({container: 'body'});
}

/**
 * builds the faction selector
 * @memberOf ui
 */
ui.build_faction_selector = function build_faction_selector() {
	$('[data-filter=faction_code]').empty();
	var tpl = Handlebars.templates['ui_deckedit-factions'];
	var faction_codes = app.data.cards.distinct('faction_code').sort();
	var gray_index = faction_codes.indexOf('gray');
	faction_codes.splice(gray_index, 1);
	faction_codes.unshift('gray');

	$('[data-filter=faction_code]').html(
		tpl({codes: get_examples(faction_codes, 'faction_code')})
	).button().find('label').tooltip({container: 'body'});
}

/**
 * builds the type selector
 * @memberOf ui
 */
ui.build_type_selector = function build_type_selector() {
	$('[data-filter=type_code]').empty();
	var tpl = Handlebars.templates['ui_deckedit-types'];

	$('[data-filter=type_code]').html(
		tpl({codes: get_examples(['battlefield','plot','character','upgrade','downgrade','support', 'event'], 'type_code')})
	).button().find('label').tooltip({container: 'body'});
}

/**
 * builds the rarity selector
 * @memberOf ui
 */
ui.build_rarity_selector = function build_rarity_selector() {
	$('[data-filter=rarity_code]').empty();
	var tpl = Handlebars.templates['ui_deckedit-rarities'];
	$('[data-filter=rarity_code]').html(
		tpl({codes: get_examples(['S','C', 'U', 'R', 'L'], 'rarity_code')})
	).button().find('label').tooltip({container: 'body'});
}

/**
 * builds the set selector
 * @memberOf ui
 */
ui.build_set_selector = function build_set_selector() {
	$('[data-filter=set_code]').empty();
	app.data.sets.find({
		name: {
			'$exists': true
		}
	}, {
	    $orderBy: {
	        position: 1
	    }
	}).forEach(function(record) {
		// checked or unchecked ? checked by default
		// var checked = !!record.available;
		// ... Give priority to the sets belonging to the format you are editing ?
		var checked = _.includes(app.deck.get_format_data().data.sets, record.code);
		$('<li><a href="#"><label><input type="checkbox" name="' + record.code + '"' + (checked ? ' checked="checked"' : '') + '>' + record.name + '</label></a></li>').appendTo('[data-filter=set_code]');
	});
}

/**
 * @memberOf ui
 */
ui.init_selectors = function init_selectors() {
	$('#format-selector').find('input[value='+app.deck.get_format_code()+']').prop('checked', true).parent().addClass('active');
	$('[data-filter=affiliation_code]').find('input[name=neutral]').prop("checked", true).parent().addClass('active');
	$('[data-filter=affiliation_code]').find('input[name='+app.deck.get_affiliation_code()+']').prop("checked", true).parent().addClass('active');
	$('[data-filter=faction_code]').find('input').prop("checked", true).parent().addClass('active');

	$('[data-filter=type_code]').find('input[name=character]').prop("checked", true).parent().addClass('active');
}

function uncheck_all_others() {
	$(this).closest('[data-filter]').find("input[type=checkbox]").prop("checked",false);
	$(this).children('input[type=checkbox]').prop("checked", true).trigger('change');
}

function check_all_others() {
	$(this).closest('[data-filter]').find("input[type=checkbox]").prop("checked",true);
	$(this).children('input[type=checkbox]').prop("checked", false);
}

function uncheck_all_active() {
	$(this).closest('[data-filter]').find("label.active").button('toggle');
}

function check_all_inactive() {
	$(this).closest('[data-filter]').find("label:not(.active)").button('toggle');
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_click_filter = function on_click_filter(event) {
	var dropdown = $(this).closest('ul').hasClass('dropdown-menu');
	if (dropdown) {
		if (event.shiftKey) {
			if (!event.altKey) {
				uncheck_all_others.call(this);
			} else {
				check_all_others.call(this);
			}
		}
		event.stopPropagation();
	} else {
		if (!event.shiftKey && Config['buttons-behavior'] === 'exclusive' || event.shiftKey && Config['buttons-behavior'] === 'cumulative') {
			if (!event.altKey) {
				uncheck_all_active.call(this);
			} else {
				check_all_inactive.call(this);
			}
		}
	}
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_input_smartfilter = function on_input_smartfilter(event) {
	var q = $(this).val();
	if(q.match(/^\w[:<>!]/)) app.smart_filter.update(q);
	else app.smart_filter.update('');
	ui.refresh_list();
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_submit_form = function on_submit_form(event) {
	var deck_json = app.deck.get_json();
	$('input[name=content]').val(deck_json);
	$('input[name=description]').val($('textarea[name=description_]').val());
	$('input[name=tags]').val($('input[name=tags_]').val());
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_config_change = function on_config_change(event) {
	var name = $(this).attr('name');
	var type = $(this).prop('type');
	switch(type) {
	case 'radio':
		var value = $(this).val();
		if(!isNaN(parseInt(value, 10))) value = parseInt(value, 10);
		Config[name] = value;
		break;
	case 'checkbox':
		Config[name] = $(this).prop('checked');
		break;
	}
	ui.write_config_to_storage();
	switch(name) {
		case 'buttons-behavior':
			break;
		case 'show-only-owned':
			ui.set_max_qty();
			ui.reset_list();
			break;
		default:
			ui.refresh_list();
	}
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_table_sort_click = function on_table_sort_click(event) {
	event.preventDefault();
	var new_sort = $(this).data('sort');
	if (SortKey == new_sort) {
		SortOrder *= -1;
	} else {
		SortKey = new_sort;
		SortOrder = 1;
	}
	ui.refresh_list();
	ui.update_sort_caret();
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_list_quantity_change = function on_list_quantity_change(event) {
	var row = $(this).closest('.card-container');
	var code = row.data('code');
	var quantity = parseInt($(this).val(), 10);
	
	var dices;
	if($('input[name=list-qty-'+code+'-0]').length) {
		dices = [];
		for(var i = 0; i < 10; i++) {
			if(!$('input[name=list-qty-'+code+'-'+i+']').length) {
				break;
			}
			if($('label.active input[name=list-qty-'+code+'-'+i+']').length) {
				var qty = parseInt($('label.active input[name=list-qty-'+code+'-'+i+']').val());
				if(qty > 0) {
					dices.push(qty);
				}
			}
		}
	}
	
	ui.on_quantity_change(code, quantity, dices);
}

/**
 * @memberOf ui
 * @param event
 */
ui.on_modal_quantity_change = function on_modal_quantity_change(event) {
	var modal = $('#cardModal');
	var code =  modal.data('code');
	var quantity = parseInt($(this).val(), 10);
	
	var dices;
	if($('input[name=modal-qty-'+code+'-0]').length) {
		dices = [];
		for(var i = 0; i < 10; i++) {
			if(!$('input[name=modal-qty-'+code+'-'+i+']').length) {
				break;
			}
			if($('label.active input[name=modal-qty-'+code+'-'+i+']').length) {
				var qty = parseInt($('label.active input[name=modal-qty-'+code+'-'+i+']').val());
				if(qty > 0) {
					dices.push(qty);
				}
			}
		}
	}
	
	modal.modal('hide');
	ui.on_quantity_change(code, quantity, dices);

	setTimeout(function () {
		$('#filter-text').typeahead('val', '').focus();
	}, 100);
}

ui.refresh_row = function refresh_row(card_code) {
	// for each set of divs (1, 2, 3 columns)
	CardDivs.forEach(function(rows) {
		var row = rows[card_code];
		if(!row) return;

		var card = app.data.cards.findById(card_code);
		var quantity = card.indeck.cards;
		var dice = card.indeck.dice;
		var dices = card.indeck.dices;
		
		if(quantity > 0 && dices) {
			for(var i=0; i < dices.length; i++) {
				row.find('input[name="list-qty-' + card_code + '-' + i +'"]').prop('checked', false).closest('label').removeClass('active');
			}
			for(var i=0; i < dices.length; i++) {
				row.find('input[name="list-qty-' + card_code + '-' + i +'"][value="'+ dices[i] +'"]').prop('checked', true).closest('label').addClass('active');
			}
		} else {
			row.find('input[name="list-qty-' + card_code +'"]').prop('checked', false).closest('label').removeClass('active');
			row.find('input[name="list-qty-' + card_code +'"][value="'+ quantity +'"]').prop('checked', true).closest('label').addClass('active');
		}
	});
}

/**
 * @memberOf ui
 */
ui.on_quantity_change = function on_quantity_change(card_code, quantity, dices) {
	var update_all = app.deck.set_card_copies(card_code, quantity, dices);
	ui.refresh_deck();

	//if one of the following or was selected or unselected...
	// "Double Down" (Across the Galaxy #143)
	// "Lightsaber Mastery" (Convergence #114)
	if(['08143', '09114'].includes(card_code)) {
		ui.set_max_qty(); //...refresh max quantity
	}

	if(update_all) {
		ui.refresh_list(_.includes(['08143', '09114'], card_code));
	}
	else {
		ui.refresh_row(card_code);
	}
}

/**
 * sets up event handlers ; dataloaded not fired yet
 * @memberOf ui
 */
ui.setup_event_handlers = function setup_event_handlers() {

	$('#format-selector').on('change', 'input', function(event) {
		app.deck.set_format_code($(this).val());
		ui.refresh_deck();
		ui.refresh_list(true);
	});

	$('[data-filter]').on({
		change : ui.refresh_list,
		click : ui.on_click_filter
	}, 'label');

	$('#filter-text').on('input', ui.on_input_smartfilter);

	$('#save_form').on('submit', ui.on_submit_form);

	$('#btn-save-as-copy').on('click', function(event) {
		$('#deck-save-as-copy').val(1);
	});

	$('#btn-cancel-edits').on('click', function(event) {
		var unsaved_edits = app.deck_history.get_unsaved_edits();
		if(unsaved_edits.length) {
			var confirmation = confirm("This operation will revert the changes made to the deck since "+unsaved_edits[0].date_creation.calendar()+". The last "+(unsaved_edits.length > 1 ? unsaved_edits.length+" edits" : "edit")+" will be lost. Do you confirm?");
			if(!confirmation) return false;
		}
		else {
			if(app.deck_history.is_changed_since_last_autosave()) {
				var confirmation = confirm("This operation will revert the changes made to the deck. Do you confirm?");
				if(!confirmation) return false;
			}
		}
		$('#deck-cancel-edits').val(1);
	});

	$('#config-options').on('change', 'input', ui.on_config_change);
	$('#collection').on('change', 'input[type=radio]', ui.on_list_quantity_change);

	$('#cardModal').on('keypress', function(event) {
		var num = parseInt(event.which, 10) - 48;
		$('#cardModal input[type=radio][value=' + num + ']').trigger('change');
	});
	$('#cardModal').on('change', 'input[type=radio]', ui.on_modal_quantity_change);
	$('thead').on('click', 'a[data-sort]', ui.on_table_sort_click);

}

/**
 * returns the current card filters as an array
 * @memberOf ui
 */
ui.get_filters = function get_filters() {
	var filters = {};
	$('[data-filter]').each(
		function(index, div) {
			var column_name = $(div).data('filter');
			var arr = [];
			$(div).find("input[type=checkbox]").each(
				function(index, elt) {
					if($(elt).prop('checked')) arr.push($(elt).attr('name'));
				}
			);
			if(arr.length) {
				filters[column_name] = {
					'$in': arr
				};
			}
		}
	);
	return filters;
}

/**
 * updates internal variables when display columns change
 * @memberOf ui
 */
ui.update_list_template = function update_list_template() {
	DisplayColumnsTpl = Handlebars.templates['ui_deckedit-display-1columns'];
}

var OptionsTemplate = Handlebars.templates['card_modal-options'];

ui.build_quantity_options = function build_quantity_options(card, prefix) {
	
	var multiple_copies = (card.type_code == 'character' && !card.is_unique && card.maxqty.dice > 1);
	if(multiple_copies) {
		if(!card.indeck.dices) {
			card.indeck.dices = [];
			for(var i = 0; i < card.maxqty.cards; i++) {
				// Will provide some kind of retro-compatibility
				card.indeck.dices.push(i < card.indeck.cards ? 1 : 0);
			}
		} else {
			for(var i = card.indeck.dices.length; i < card.maxqty.cards; i++) {
				card.indeck.dices.push(0);
			}
		}
	}

	return OptionsTemplate({
		card: card,
		prefix: prefix,
		unique_character: (card.type_code == 'character' && card.is_unique),
		multiple_copies: multiple_copies
	});
}

/**
 * builds a row for the list of available cards
 * @memberOf ui
 */
ui.build_row = function build_row(card) {
	var html = DisplayColumnsTpl({
		qty_options: ui.build_quantity_options(card, 'list'),
		url: Routing.generate('cards_zoom', {card_code:card.code}),
		card: card,
	});
	return $(html);
}

ui.reset_list = function reset_list() {
	CardDivs = [[],[],[]];
	ui.refresh_list();
}

/**
 * destroys and rebuilds the list of available cards
 * don't fire unless 250ms has passed since last invocation
 * @memberOf ui
 */
ui.refresh_list = _.debounce(function refresh_list(refresh) {
	$('#collection-table').empty();
	$('#collection-grid').empty();

	var counter = 0,
		container = $('#collection-table'),
		filters = ui.get_filters(),
		query = $.extend({}, app.smart_filter.get_query(filters), {
			/* 
			Do not hide reprinted cards, displays them all if needed
			reprint_of: {$exists: false} 
			*/
		}, true),
		orderBy = {};

	SortKey.split('|').forEach(function (key ) {
		orderBy[key] = SortOrder;
	});
	if(SortKey !== 'name') orderBy['name'] = 1;
	var cards = app.data.cards.find(query, {'$orderBy': orderBy});
	var divs = CardDivs[0];

	cards.forEach(function (card) {
		if (Config['show-only-deck'] && !card.indeck.cards) return;
		var unusable = !app.deck.can_include_card(card);
		if (!Config['show-unusable'] && unusable) return;
		if (Config['show-only-owned'] && card.maxqty.cards==0) return;
		if(card.type_code=='plot' && !card.points) return; // Hide some plots face B
		
		var row = divs[card.code];
		if(!row || refresh) row = divs[card.code] = ui.build_row(card);

		row.data("code", card.code).addClass('card-container');

		row.find('[data-toggle="tooltip"]').tooltip();

		var quantity = card.indeck.cards;
		var dices = card.indeck.dices;
		
		if(quantity > 0 && dices) {
			for(var i=0; i < dices.length; i++) {
				row.find('input[name="list-qty-' + card.code + '-' + i +'"]').prop('checked', false).closest('label').removeClass('active');
			}
			for(var i=0; i < dices.length; i++) {
				row.find('input[name="list-qty-' + card.code + '-' + i +'"][value="'+ dices[i] +'"]').prop('checked', true).closest('label').addClass('active');
			}
		} else {
			row.find('input[name="list-qty-' + card.code +'"]').prop('checked', false).closest('label').removeClass('active');
			row.find('input[name="list-qty-' + card.code +'"][value="'+ quantity +'"]').prop('checked', true).closest('label').addClass('active');
		}

		if (unusable) {
			row.find('label').addClass("disabled").find('input[type=radio]').prop("disabled", true);
		}

		container.append(row);
		counter++;
	});
}, 250);

/**
 * called when the deck is modified and we don't know what has changed
 * @memberOf ui
 */
ui.on_deck_modified = function on_deck_modified() {
	ui.refresh_deck();
	ui.refresh_list();
}


/**
 * @memberOf ui
 */
ui.refresh_deck = function refresh_deck() {
	app.deck.display('#deck');
	app.draw_simulator && app.draw_simulator.reset();
	app.deck_charts && app.deck_charts.setup();
}

/**
 * @memberOf ui
 */
ui.setup_typeahead = function setup_typeahead() {

	function findMatches(q, cb) {
		if(q.match(/^\w:/)) return;
		var regexp = new RegExp(q, 'i');
		var cards = app.data.cards.find({name: regexp });
		// Take the "show unusable cards" option onto account
		// As there are far more news cards than before
		if (!Config['show-unusable']) {
			cards = cards.filter(card => app.deck.can_include_card(card));
		}
		cb(cards);
	}

	$('#filter-text').typeahead({
		hint: true,
		highlight: true,
		minLength: 2
	},{
		name : 'cardnames',
		displayKey: 'label',
		source: findMatches
	});

}

ui.update_sort_caret = function update_sort_caret() {
	var elt = $('[data-sort="'+SortKey+'"]');
	$(elt).closest('tr').find('th').removeClass('dropup').find('span.caret').remove();
	$(elt).after('<span class="caret"></span>').closest('th').addClass(SortOrder > 0 ? '' : 'dropup');
}

ui.init_filter_help = function init_filter_help() {
	$('#filter-text-button').popover({
		container: 'body',
		content: app.smart_filter.get_help(),
		html: true,
		placement: 'bottom',
		title: Translator.trans('decks.smartfilter.title')
	});
}

ui.setup_dataupdate = function setup_dataupdate() {
	$('a.data-update').click(function (event) {
		$(document).on('data.app', function (event) {
			$('a.data-update').parent().text("Data refreshed. You can save or reload your deck.");
		});
		app.data.update();
		return false;
	})
}

/**
 * called when the DOM is loaded
 * @memberOf ui
 */
ui.on_dom_loaded = function on_dom_loaded() {
	ui.init_config_buttons();
	ui.init_filter_help();
	ui.update_sort_caret();
	ui.setup_event_handlers();
	app.textcomplete && app.textcomplete.setup('#description');
	app.markdown && app.markdown.setup('#description', '#description-preview')
	app.draw_simulator && app.draw_simulator.on_dom_loaded();
	app.card_modal && $('#filter-text').on('typeahead:selected typeahead:autocompleted', app.card_modal.typeahead);
};

/**
 * called when the app data is loaded
 * @memberOf ui
 */
ui.on_data_loaded = function on_data_loaded() {
	if(app.collection.isLoaded) {
		ui.on_collection_loaded();
	} else {
		$(document).on('collection.app', function(e) {
			ui.on_collection_loaded();
		});
	}
	app.draw_simulator && app.draw_simulator.on_data_loaded();
};

/**
 * called when both the DOM and the data app have finished loading
 * @memberOf ui
 */
ui.on_all_loaded = function on_all_loaded() {
	ui.update_list_template();
	ui.build_format_selector();
	ui.build_affiliation_selector();
	ui.build_faction_selector();
	ui.build_type_selector();
	ui.build_rarity_selector();
	ui.build_set_selector();
	ui.init_selectors();
	ui.refresh_deck();
	ui.refresh_list();
	ui.setup_typeahead();
	ui.setup_dataupdate();
	app.deck_history && app.deck_history.setup('#history');
};

ui.read_config_from_storage();

})(app.ui, jQuery);
