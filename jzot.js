/**
 * @preserve
 * jZot v0.0.3
 * http://thetaylor.co.uk/jzot/
 *
 * Use jzot.css for basic styling.
 *
 * Copyright (c) 2012 Andrew Taylor
 * Dual licensed under the MIT and GPL licenses, located in
 * MIT-LICENSE.txt and GPL-LICENSE.txt respectively.
 *
 * Date: Wed Oct 24 21:22:31 2012
 *
 */

(function( $ ) {
	
	var methods = {
		init : function( options ) { 
			var now = new Date();
			var saltDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
			
			var zoteroMaxResults = 99;
			var settings = $.extend({
				'testing'			: true,
				'attachments'		: true,
				'userID'			: '',
				'groupID'			: '',
				'order'				: 'date',
				'itemType'			: 'journalArticle',
				'collectionKey'		: '',
				'style'				: 'apa',
				'author'			: '',
				'detailed'			: false,
				'forceUpdate'		: false,
				'date'				: saltDate.getTime(),
				'target'			: Math.floor(Math.random()*1001) // Make sure the correct target is used
			}, options);
			
			// LIMIT TO DO
			// If returned results == zoteroMaxResults then get the next batch!
			// Also add limit stuff

			if(settings.userID || settings.groupID) {
				var $this = this;
				var attempts = 0;
				var forceUpdate = '&saltDate=' + (settings.testing == true) ? new Date().getTime() / 1000 : settings.date;
				var library = (settings.groupID) ? "groups/" + settings.groupID : "users/" + settings.userID;
				
				if(settings.collectionKey) {
					var url = "https://api.zotero.org/" + library + "/collections/" + settings.collectionKey + "/items?format=atom&content=json&itemType=" + settings.itemType + "&order=" + settings.order + "&limit=" + zoteroMaxResults + forceUpdate;
				} else {
					var url = "https://api.zotero.org/" + library + "/items?format=atom&content=json&itemType=" + settings.itemType + "&order=" + settings.order + "&limit=" + zoteroMaxResults + forceUpdate;
				}
				
				zoteroReadApi(url);
			} else {
				$.error( 'jQuery.zotero requires a zotero userID or groupID' );
			}
			
			function zoteroReadApi(url) {
				if(attempts > 4) {
					if(window.console) window.console.log('Permanent failure to retrieve feed ' + url);
					return;
				}
				attempts++;
				$.ajax({
					url: document.location.protocol + '//ajax.googleapis.com/ajax/services/feed/load?v=1.0&output=xml&num=-1&callback=?&q=' + encodeURIComponent(url),
					dataType: 'json',
					success: function(data) {
						if(!data.responseData) {
							if(window.console) window.console.log('Failed to retrieve feed ' + url);
							zoteroReadApi(url);
							return;
						}
						var xmlDoc = $.parseXML(data.responseData.xmlString),
						$xml = $(xmlDoc),
						$title = $xml.find("feed>title"),
						$references = $xml.find("feed>entry");
						
						if(window.console) window.console.log($references.length);
						
						var formattedOutput = '';
						
						$references.each(function(index) {
							var author = $(this).find("author>name").text();
							var author_names = author.split(" ");
					
							var reference = {
								id: $(this).find("id").text().split("/").pop(),
								children: $(this).children().filterNode('zapi:numChildren').text(),
								type: $(this).children().filterNode('zapi:itemType').text(),
								author: author,
								author_fname: author_names[0],
								author_sname: author_names.slice(-1)[0],
								content: $.parseJSON($(this).find("content").text())
							};
							reference.content.date = reference.content.date.replace("(","").replace(")","");
					
							//Children
							if(settings.attachments == true && reference.children != "" && reference.children != "0" && reference.children != 0) {
								$.ajax({
									url: document.location.protocol + '//ajax.googleapis.com/ajax/services/feed/load?v=1.0&output=xml&num=-1&callback=?&q=' + encodeURIComponent("https://api.zotero.org/" + library + "/items/" + reference.id + "/children?format=atom&content=json&itemType=attachment&order=date"),
									dataType: 'json',
									success: function(data) {
										var xmlDocAttachment = $.parseXML(data.responseData.xmlString),
										reference_obj = $.parseJSON($(xmlDocAttachment).find("feed>entry").first().find("content").text());
										if(reference_obj.url) $("p#" + settings.target + '_' + reference.id).append(' <a href="' + reference_obj.url + '" target="_blank">[ Link ]</a>');
									}
								});
							}
							
							var output = generateCitationStyle(reference);
							var thumbnail = '';
							var abstract = '';
							if(settings.detailed == true) {
								if(reference.content.extra) thumbnail = '<img src="' + reference.content.extra + '" class="thumbnail" />';
								if(reference.content.abstractNote) abstract = '<p class="abstract">' + reference.content.abstractNote + '</p>';
							}
							var title = thumbnail + output;
							if(reference.content.url) title = '<a href="' + reference.content.url + '" target="_blank">' + title + '</a>';
							formattedOutput += '<p id="' + settings.target + '_' + reference.id + '" class="' + reference.type + '">' + title + '</p>' + abstract;

						});
						
						return $this.each(function(){
							$(this).addClass('zotero').html(formattedOutput);
						});
					}
				});
			}
			function generateCitationStyle(reference) {
				//Authors and Editors
				var author_str = "";
				var authors = reference.content.creators;
				var editor_str = "";
				var editors = [];
	
				if(authors.length > 0) {
					// Check there are no editors in this section
					for(var i = authors.length -1; i > -1; i--) {
						if(typeof authors[i] == "undefined") continue;
						if(authors[i].firstName.toLowerCase().indexOf('(eds.)') != -1 || authors[i].lastName.toLowerCase().indexOf('(eds.)') != -1 || authors[i].lastName.toLowerCase().indexOf('(ed.)') != -1) {
							editors.push(authors[i]);
							authors.splice(i, 1);
						}
					}
				}
				var output = "";
				switch(settings.style)
				{
				case "apa":
					// Journal Article
					// Read, D. & Grushka-Cockayne, Y. (2011). The similarity heuristic.  Journal of Behavioral Decision Making, 24, 23-46.  
					
					// Book
					// Eubanks, D. L., & Mumford, M. D. (2010) Destructive leadership:  The role of cognitive processes. In B. Schyns & T. Hansbrough (Eds.), When leadership goes wrong: Destructive leadership, mistakes and ethical failures.  Charlotte, NC: Information Age Publishing.
													
					if(authors.length > 0) {
						for (var i = 0; i < authors.length; i++) {
							if(undefined != authors[i]) {
								if(i != 0 && i == authors.length - 1) {
									author_str += " &amp; ";
								} else if(i > 0 && i < authors.length - 1) {
									author_str += ", "
								}
								author_str += capitaliseFirstLetter(clean(authors[i].lastName)) + ', ' + capitaliseFirstLetter(clean(authors[i].firstName).charAt(0)) + '.';
							}
						}
					}
					
					if(editors.length > 0) {
						for (var i = 0; i < editors.length; i++) {
							if(undefined != editors[i]) {
								if(i != 0 && i == editors.length - 1) {
									editor_str += " &amp; ";
								} else if(i > 0 && i < editors.length - 1) {
									editor_str += ", "
								}
								if(undefined != editors[i].lastName) editor_str += capitaliseFirstLetter(clean(editors[i].lastName.replace(/\(eds.\)/gi, "").replace(/\(ed.\)/gi, ""))) + ', ';
								if(undefined != editors[i].firstName) editor_str += capitaliseFirstLetter(clean(editors[i].firstName.replace(/\(eds.\)/gi, "").replace(/\(ed.\)/gi, "")).charAt(0)) + '.';
							}
						}
					}
					
					output = removeLastChar(trim(author_str), ',');
					if(reference.content.date) output += ' (' + clean(reference.content.date) + ').';
					if(reference.content.title) output += ' ' + clean(reference.content.title) + '.';
					if(editor_str) {
						output += ' In ' + clean(editor_str);
						if(editors.length > 1) {
							output += ' (Eds.),';
						} else {
							output += ' (Ed.),';
						}
					}
					if(reference.content.publicationTitle) output += ' <i>' + clean(reference.content.publicationTitle) + '</i>';
					if(reference.content.bookTitle) output += ' <i>' + clean(reference.content.bookTitle) + '</i>';
					if(reference.content.volume) output += ', <i>' + clean(reference.content.volume) + '</i>';
					if(reference.content.issue) output += '(' + clean(reference.content.issue) + ')';
					if(reference.content.bookTitle) {
						if(reference.content.pages) output += ', (pp. ' + clean(reference.content.pages) + ')';
					} else {
						if(reference.content.pages) output += ', ' + clean(reference.content.pages);
					}
					if(reference.content.place) output += '. ' + clean(reference.content.place);
					if(reference.content.publisher) output += ': ' + clean(reference.content.publisher);
					output += '.';		
					break;
				case "co-author":
					//Some Implications of a More General Form of Regret Theory, (with Robert Sugden), Journal of Economic Theory, 41, 270-87, (1987).
					
					if(authors.length > 0) {
						for(var i = authors.length -1; i > -1; i--) {
							if(typeof authors[i] == "undefined") continue;
							if(settings.author) {
								if(authors[i].lastName.toLowerCase() == settings.author.toLowerCase()) {
									authors.splice(i, 1);
								}
							} else {
								if(authors[i].lastName.toLowerCase() == reference.author_sname.toLowerCase()) {
									authors.splice(i, 1);
								}
							}
						}
					}
					
					if(editors.length > 0) {
						for(var i = editors.length -1; i > -1; i--) {
							if(typeof editors[i] == "undefined") continue;
							if(editors[i].lastName.toLowerCase() == reference.author_sname.toLowerCase()) {
								editors.splice(i, 1);
							}
						}
					}
					
					if(authors.length > 0) {
						author_str = '(with ';
						for (var i = 0; i < authors.length; i++) {
							if(undefined != authors[i]) {
								if(i != 0 && i == authors.length - 1) {
									author_str += " and ";
								} else if(i > 0 && i < authors.length - 1) {
									author_str += ", "
								}
								author_str +=  capitaliseFirstLetter(clean(authors[i].firstName)) + ' ' + capitaliseFirstLetter(clean(authors[i].lastName));
							}
						}
						author_str += ')';
					}
					
					if(editors.length > 0) {
						if(editors.length > 1) {
							editor_str = 'eds ';
						} else {
							editor_str = 'ed ';
						}
						for (var i = 0; i < editors.length; i++) {
							if(undefined != editors[i]) {
								if(i != 0 && i == editors.length - 1) {
									editor_str += " and ";
								} else if(i > 0 && i < editors.length - 1) {
									editor_str += ", "
								}
								if(editors[i].firstName != "") editor_str += capitaliseFirstLetter(clean(editors[i].firstName.replace(/\(eds.\)/gi, ""))) + ' ';
								if(editors[i].lastName != "") editor_str += capitaliseFirstLetter(clean(editors[i].lastName.replace(/\(eds.\)/gi, "")));
							}
						}
					}
		
					output = removeLastChar(trim(reference.content.title), ',');
					if(author_str) output += ', ' + author_str;
					if(reference.content.publicationTitle) output += ', <i>' + removeLastChar(trim(reference.content.publicationTitle), ',') + '</i>';
					if(reference.content.volume) output += ', <strong>' + removeLastChar(trim(reference.content.volume), ',') + '</strong>';
					if(reference.content.pages) output += ', ' + removeLastChar(trim(reference.content.pages), ',');
					if(editor_str) output += ', ' + clean(editor_str);
					if(reference.content.publisher) output += '. ' + clean(reference.content.publisher);
					if(reference.content.date) output += ', (' + removeLastChar(removeLastChar(trim(reference.content.date), ','), '.') + ')';
					output = clean(output) + '.';
					break;
				default:
					if(window.console) window.console.log(style + " not found");
				}
				return output;
			}
			function clean(str) {
				return removeLastChar(removeLastChar(trim(str), ','), '.');
			}
			function trim(str) {
				var	str = str.replace(/^\s\s*/, ''),
					ws = /\s/,
					i = str.length;
				while (ws.test(str.charAt(--i)));
				return str.slice(0, i + 1);
			}
			function capitaliseFirstLetter(string) {
					return string.charAt(0).toUpperCase() + string.slice(1);
			}
			function removeLastChar(string, char) {
					if (string.substring(string.length-1) == char) string = string.substring(0, string.length-1);
					return string;
			}
		}
	};
	
	$.fn.jzot = function( method ) {
		// Method calling logic
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.zotero' );
		}    
	};
	
	$.fn.filterNode = function( name ){
		return this.filter(function(){
			return this.nodeName === name;
		});
	};
})( jQuery );