// @codekit-prepend "lib/jquery-1.11.1.min.js"
// @codekit-prepend "lib/lib.js"
// @codekit-prepend "utils/tabs.js"
// @codekit-prepend "utils/preview.js"
// @codekit-prepend "gitea/issue_label.js"
// @codekit-prepend "lib/jquery.tipsy.js"

var Gitea = {};

(function ($) {
    // Extend jQuery ajax, set CSRF token value.
    var ajax = $.ajax;
    $.extend({
        ajax: function (url, options) {
            if (typeof url === 'object') {
                options = url;
                url = undefined;
            }
            options = options || {};
            url = options.url;
            var csrftoken = $('meta[name=_csrf]').attr('content');
            var headers = options.headers || {};
            var domain = document.domain.replace(/\./ig, '\\.');
            if (!/^(http:|https:).*/.test(url) || eval('/^(http:|https:)\\/\\/(.+\\.)*' + domain + '.*/').test(url)) {
                headers = $.extend(headers, {'X-Csrf-Token': csrftoken});
            }
            options.headers = headers;
            var callback = options.success;
            options.success = function (data) {
                if (data.once) {
                    // change all _once value if ajax data.once exist
                    $('[name=_once]').val(data.once);
                }
                if (callback) {
                    callback.apply(this, arguments);
                }
            };
            return ajax(url, options);
        },

        changeHash: function (hash) {
            if (history.pushState) {
                history.pushState(null, null, hash);
            }
            else {
                location.hash = hash;
            }
        },

        deSelect: function () {
            if (window.getSelection) {
                window.getSelection().removeAllRanges();
            } else {
                document.selection.empty();
            }
        }
    });
    $.fn.extend({
        toggleHide: function () {
            $(this).addClass("hidden");
        },
        toggleShow: function () {
            $(this).removeClass("hidden");
        },
        toggleAjax: function (successCallback, errorCallback) {
            var url = $(this).data("ajax");
            var method = $(this).data('ajax-method') || 'get';
            var ajaxName = $(this).data('ajax-name');
            var data = {};

            if (ajaxName.endsWith("preview")) {
                data["mode"] = "gfm";
                data["context"] = $(this).data('ajax-context');
            }

            $('[data-ajax-rel=' + ajaxName + ']').each(function () {
                var field = $(this).data("ajax-field");
                var t = $(this).data("ajax-val");
                if (t == "val") {
                    data[field] = $(this).val();
                    return true;
                }
                if (t == "txt") {
                    data[field] = $(this).text();
                    return true;
                }
                if (t == "html") {
                    data[field] = $(this).html();
                    return true;
                }
                if (t == "data") {
                    data[field] = $(this).data("ajax-data");
                    return true;
                }
                return true;
            });
            console.log("toggleAjax:", method, url, data);
            $.ajax({
                url: url,
                method: method.toUpperCase(),
                data: data,
                error: errorCallback,
                success: function (d) {
                    if (successCallback) {
                        successCallback(d);
                    }
                }
            })
        }
    });
}(jQuery));

(function ($) {
    // Render markdown.
    Gitea.renderMarkdown = function () {
        var $md = $('.markdown');
        var $pre = $md.find('pre > code').parent();
        $pre.addClass('prettyprint');
        prettyPrint();

        // Set anchor.
        var headers = {};
        $md.find('h1, h2, h3, h4, h5, h6').each(function () {
            var node = $(this);
            var val = encodeURIComponent(node.text().toLowerCase().replace(/[^\w\- ]/g, '').replace(/[ ]/g, '-'));
            var name = val;
            if (headers[val] > 0) {
                name = val + '-' + headers[val];
            }
            if (headers[val] == undefined) {
                headers[val] = 1;
            } else {
                headers[val] += 1;
            }
            node = node.wrap('<div id="' + name + '" class="anchor-wrap" ></div>');
            node.append('<a class="anchor" href="#' + name + '"><span class="octicon octicon-link"></span></a>');
        });
    };

    // Render code view.
    Gitea.renderCodeView = function () {
        function selectRange($list, $select, $from) {
            $list.removeClass('active');
            if ($from) {
                var a = parseInt($select.attr('rel').substr(1));
                var b = parseInt($from.attr('rel').substr(1));
                var c;
                if (a != b) {
                    if (a > b) {
                        c = a;
                        a = b;
                        b = c;
                    }
                    var classes = [];
                    for (i = a; i <= b; i++) {
                        classes.push('.L' + i);
                    }
                    $list.filter(classes.join(',')).addClass('active');
                    $.changeHash('#L' + a + '-' + 'L' + b);
                    return
                }
            }
            $select.addClass('active');
            $.changeHash('#' + $select.attr('rel'));
        }

        $(document).on('click', '.lines-num span', function (e) {
            var $select = $(this);
            var $list = $select.parent().siblings('.lines-code').find('ol.linenums > li');
            selectRange($list, $list.filter('[rel=' + $select.attr('rel') + ']'), (e.shiftKey ? $list.filter('.active').eq(0) : null));
            $.deSelect();
        });

        $('.code-view .lines-code > pre').each(function () {
            var $pre = $(this);
            var $lineCode = $pre.parent();
            var $lineNums = $lineCode.siblings('.lines-num');
            if ($lineNums.length > 0) {
                var nums = $pre.find('ol.linenums > li').length;
                for (var i = 1; i <= nums; i++) {
                    $lineNums.append('<span id="L' + i + '" rel="L' + i + '">' + i + '</span>');
                }
            }
        });

        $(window).on('hashchange', function (e) {
            var m = window.location.hash.match(/^#(L\d+)\-(L\d+)$/);
            var $list = $('.code-view ol.linenums > li');
            var $first;
            if (m) {
                $first = $list.filter('.' + m[1]);
                selectRange($list, $first, $list.filter('.' + m[2]));
                $("html, body").scrollTop($first.offset().top - 200);
                return;
            }
            m = window.location.hash.match(/^#(L\d+)$/);
            if (m) {
                $first = $list.filter('.' + m[1]);
                selectRange($list, $first);
                $("html, body").scrollTop($first.offset().top - 200);
            }
        }).trigger('hashchange');
    };

    // Render diff view.
    Gitea.renderDiffView = function () {
        function selectRange($list, $select, $from) {
            $list.removeClass('active');
            $list.parents('tr').removeClass('end-selected-line');
            $list.parents('tr').find('td').removeClass('selected-line');
            if ($from) {
                var expr = new RegExp(/diff-(\w+)([LR]\d+)/);
                var selectMatches = $select.attr('rel').match(expr)
                var fromMatches = $from.attr('rel').match(expr)
                var selectTop = $select.offset().top;
                var fromTop = $from.offset().top;
                var hash;

                if (selectMatches[2] != fromMatches[2]) {
                    if ((selectTop > fromTop)) {
                        $startElem = $from;
                        $endElem = $select;
                        hash = fromMatches[1]+fromMatches[2] + '-' + selectMatches[2];
                    } else {
                        $startElem = $select;
                        $endElem = $from;
                        hash = selectMatches[1]+selectMatches[2] + '-' + fromMatches[2];
                    }
                    $endElem.parents('tr').next().addClass('end-selected-line');
                    var $selectedLines = $startElem.parents('tr').nextUntil('.end-selected-line').andSelf();
                    $selectedLines.find('td.lines-num > span').addClass('active')
                    $selectedLines.find('td').addClass('selected-line');
                    $.changeHash('#diff-'+hash);
                    return
                }
            }
            $select.addClass('active');
            $select.parents('tr').find('td').addClass('selected-line');
            $.changeHash('#' + $select.attr('rel'));
        }

        function prepareToForm() {
            $('.add-comment').hide('fast', function(){ $(this).remove(); });
            $('button.answer').hide();
        }

        $(document).on('click', '.code-diff .lines-num span', function (e) {
            var $select = $(this);
            var $list = $select.parent().siblings('.lines-code').parents().find('td.lines-num > span');
            selectRange(
                $list,
                $list.filter('[rel=' + $select.attr('rel') + ']'),
                (e.shiftKey && $list.filter('.active').length ? $list.filter('.active').eq(0) : null)
            );
            $.deSelect();
        });

        $('.code-diff .lines-code > b, .code-diff .lines-code > button.answer').click(function () {
            prepareToForm();
            var commit = document.location.href.match(/([a-zA-Z0-9-.:\/\/]+)\/commit\/([a-z0-9]+)/);
            console.log(commit);
            var lineNum;
            if ($(this).prop("tagName") == "BUTTON") {                
                lineNum = $(this).attr('rel');                                
            } else {
                lineNum = $(this).parent().prev().find('span').attr('rel');
            }
            $('button[rel='+lineNum+']').fadeOut();
            lineNum = lineNum.substr(5);
            var commentTr = $(".comment-"+lineNum);
            if (commit) {
                var elem = (commentTr.length > 0) ? commentTr : $(this).parents('tr');
                var url = commit[1] + '/commit/comment/' + commit[2];
                elem.after(
                    $('<tr class="add-comment">').append(
                        $('<td colspan="3">').load(url + '?line=' + lineNum, function () {
                            $('.menu-line.add-nav').tabs();
                            $('#pull-commit-preview').markdown_preview(".commit-add-comment");
                            $('body').animate({
                                scrollTop: $(this).offset().top - 33 // height of button
                            }, 1000);
                        })
                    )
                );
            }
        });

        $('.code-diff').on('click', '#cancel-commit-conversation', function () {
            prepareToForm();
            $('button.answer').show();
            return false;
        });


        $('.code-diff').on('click', '#cancel-edit-commit-conversation', function () {
            prepareToForm();
            $(this).parents('.commit-comment').children().show();
            $(this).parents('#commit-conversation').parent().remove();
            $('button.answer').show();
            return false;
        });

        $('.edit-comment').click(function () {
            prepareToForm();
            var text = $(this).parents('div.panel:first').find('.markdown').text();
            var id = $(this).parents('.commit-comment').attr('id');
            id = id.substr(15);
            var commit = document.location.href.match(/([a-zA-Z0-9-.:\/\/]+)\/commit\/([a-z0-9]+)/);
            var url = commit[1] + '/commit/comment/' + commit[2];
            $(this).parents('.commit-comment').children().hide();
            $(this).parents('.commit-comment').append(
                $('<div>').load(url + '?id='+id, function () {
                    $('.menu-line.add-nav').tabs();
                    $('#pull-commit-preview').markdown_preview(".commit-add-comment");
                    $('#commit-add-content').text(text.trim());
                    $('body').animate({
                        scrollTop: $(this).offset().top - 33 // height of button
                    }, 1000);
                })
            )
            return false;
        });

        $('.remove-comment').click(function () {
            if (confirm('Are you sure?')) {
                var commit = document.location.href.match(/([a-zA-Z0-9-.:\/\/]+)\/commit\/([a-z0-9]+)/);
                var url = commit[1] + '/commit/comment/delete/';
                $.ajax({
                    url: url,
                    data: {comment: $(this).data('id')},
                    dataType: 'json',
                    method: 'post',
                    success: function (json) {
                        if (json.ok) {
                            location.reload();
                        } else {
                            alert(json.error);
                        }
                    }
                });
            }
            return false;
        });

        $('.code-diff').on('submit', '#commit-add-comment-form', function () {
            var url = $(this).attr('action');
            $.ajax({
                url: url,
                data: $(this).serialize(),
                dataType: "json",
                method: "post",
                success: function (json) {
                    if (json.ok && json.data.length) {
                        window.location.href = json.data;
                        location.reload();
                    } else {
                        $('#submit-error').html(json.error);
                    }
                }
            });
            return false;
        });

        $('.code-diff .lines-code > pre').each(function () {
            var $pre = $(this);
            var $lineCode = $pre.parent();
            var $lineNums = $lineCode.siblings('.lines-num');
            if ($lineNums.length > 0) {
                var nums = $pre.find('ol.linenums > li').length;
                for (var i = 1; i <= nums; i++) {
                    $lineNums.append('<span id="L' + i + '" rel="L' + i + '">' + i + '</span>');
                }
            }
        });

        $('.code-diff .add-code .lines-code > pre, \
            .code-diff .del-code .lines-code > pre, \
            .code-diff .add-code .lines-code > b, \
            .code-diff .del-code .lines-code > b, \
            .code-diff .add-code .lines-num, \
            .code-diff .del-code .lines-num').hover(function () {
            var $b = $(this).parents('tr').find('b');
            $b.addClass('ishovered');
        });

        $('.code-diff tr').mouseleave(function () {
            $('.code-diff .lines-code > b').removeClass('ishovered');
        });

        $(window).on('hashchange', function (e) {
            var m = window.location.hash.match(/^#diff-(\w+)([LR]\d+)\-([LR]\d+)$/);
            var $list = $('.code-diff td.lines-num > span');
            var $first;
            if (m) {
                $first = $list.filter('[rel=diff-' + m[1] + m[2] + ']');
                selectRange($list, $first, $list.filter('[rel=diff-' + m[1] + m[3] + ']'));
                $("html, body").scrollTop($first.offset().top - 200);
                return;
            }
            m = window.location.hash.match(/^#diff-(\w+)([LR]\d+)$/);
            if (m) {
                $first = $list.filter('[rel=diff-' + m[1] + m[2] + ']');
                selectRange($list, $first);
                $("html, body").scrollTop($first.offset().top - 200);
                return;
            }
            m = window.location.hash.match(/^#comment-(\d+)$/);
            if (m) {
                $("html, body").animate({
                    scrollTop: $('a[name=comment-'+m[1]+']').offset().top
                }, 1000);
                return;
            }
        }).trigger('hashchange');
    };

    // Search users by keyword.
    Gitea.searchUsers = function (val, $target) {
        var notEmpty = function (str) {
          return str && str.length > 0;
        }
        $.ajax({
            url: Gitea.AppSubUrl + '/api/v1/users/search?q=' + val,
            dataType: "json",
            success: function (json) {
                if (json.ok && json.data.length) {
                    var html = '';
                    $.each(json.data, function (i, item) {
                        html += '<li><a><img src="' + item.avatar_url + '"><span class="username">' + item.username + '</span>';
                        if (notEmpty(item.full_name)) {
                          html += ' (' + item.full_name + ')';
                        }
                        html += '</a></li>';
                    });
                    $target.html(html);
                    $target.toggleShow();
                } else {
                    $target.toggleHide();
                }
            }
        });
    }

    // Search repositories by keyword.
    Gitea.searchRepos = function (val, $target, $param) {
        $.ajax({
            url: Gitea.AppSubUrl + '/api/v1/repos/search?q=' + val + '&' + $param,
            dataType: "json",
            success: function (json) {
                if (json.ok && json.data.length) {
                    var html = '';
                    $.each(json.data, function (i, item) {
                        html += '<li><a><span class="octicon octicon-repo"></span> ' + item.full_name + '</a></li>';
                    });
                    $target.html(html);
                    $target.toggleShow();
                } else {
                    $target.toggleHide();
                }
            }
        });
    }

    // Copy util.
    Gitea.bindCopy = function (selector) {
        if ($(selector).hasClass('js-copy-bind')) {
            return;
        }
        $(selector).zclip({
            path: Gitea.AppSubUrl + "/js/ZeroClipboard.swf",
            copy: function () {
                var t = $(this).data("copy-val");
                var to = $($(this).data("copy-from"));
                var str = "";
                if (t == "txt") {
                    str = to.text();
                }
                if (t == 'val') {
                    str = to.val();
                }
                if (t == 'html') {
                    str = to.html();
                }
                return str;
            },
            afterCopy: function () {
                var $this = $(this);
                $this.tipsy("hide").attr('original-title', $this.data('after-title'));
                setTimeout(function () {
                    $this.tipsy("show");
                }, 200);
                setTimeout(function () {
                    $this.tipsy('hide').attr('original-title', $this.data('original-title'));
                }, 2000);
            }
        }).addClass("js-copy-bind");
    }
})(jQuery);

function initCore() {
    Gitea.renderMarkdown();

    if ($('.code-diff').length == 0) {
        Gitea.renderCodeView();
    } else {
        Gitea.renderDiffView();
    }

    // Switch list.
    $('.js-tab-nav').click(function (e) {
        if (!$(this).hasClass('js-tab-nav-show')) {
            $(this).parent().find('.js-tab-nav-show').each(function () {
                $(this).removeClass('js-tab-nav-show');
                $($(this).data('tab-target')).hide();
            });
            $(this).addClass('js-tab-nav-show');
            $($(this).data('tab-target')).show();
        }
        e.preventDefault();
    });

    // Popup.
    $(document).on('click', '.popup-modal-dismiss', function (e) {
        e.preventDefault();
        $.magnificPopup.close();
    });

    // Plugins.
    $('.collapse').hide();
    $('.tipsy-tooltip').tipsy({
        fade: true
    });
    $('input[type=password]').hideShowPassword({
      show: false,
      innerToggle: true,
      wrapper: {
          enforceWidth: false,
          styles: {},
          inheritStyles: []
      }
    });
}

function initUserSetting() {
    // Confirmation of change username in user profile page.
    var $username = $('#username');
    var $profile_form = $('#user-profile-form');
    $('#change-username-btn').magnificPopup({
        modal: true,
        callbacks: {
            open: function () {
                if (($username.data('uname') == $username.val())) {
                    $.magnificPopup.close();
                    $profile_form.submit();
                }
            }
        }
    }).click(function () {
        if (($username.data('uname') != $username.val())) {
            e.preventDefault();
            return true;
        }
    });
    $('#change-username-submit').click(function () {
        $.magnificPopup.close();
        $profile_form.submit();
    });

    // Show panels.
    $('.show-form-btn').click(function () {
        $($(this).data('target-form')).removeClass("hide");
    });

    // Confirmation of delete account.
    $('#delete-account-btn').magnificPopup({
        modal: true
    }).click(function (e) {
        e.preventDefault();
        return true;
    });
    $('#delete-account-submit').click(function () {
        $.magnificPopup.close();
        $('#delete-account-form').submit();
    });
}

function initRepoCreate() {
    // Owner switch menu click.
    $('#repo-create-owner-list').on('click', 'li', function () {
        if (!$(this).hasClass('checked')) {
            var uid = $(this).data('uid');
            $('#repo-owner-id').val(uid);
            $('#repo-owner-avatar').attr("src", $(this).find('img').attr("src"));
            $('#repo-owner-name').text($(this).text().trim());

            $(this).parent().find('.checked').removeClass('checked');
            $(this).addClass('checked');
            console.log("set repo owner to uid :", uid, $(this).text().trim());
        }
    });

    $('#auth-button').click(function (e) {
        $('#repo-migrate-auth').slideToggle('fast');
        e.preventDefault();
    })
    console.log('initRepoCreate');
}

function initRepo() {
    // Clone link switch button.
    $('#repo-clone-ssh').click(function () {
        $(this).removeClass('btn-gray').addClass('btn-blue');
        $('#repo-clone-https').removeClass('btn-blue').addClass('btn-gray');
        $('#repo-clone-url').val($(this).data('link'));
        $('.clone-url').text($(this).data('link'))
    });
    $('#repo-clone-https').click(function () {
        $(this).removeClass('btn-gray').addClass('btn-blue');
        $('#repo-clone-ssh').removeClass('btn-blue').addClass('btn-gray');
        $('#repo-clone-url').val($(this).data('link'));
        $('.clone-url').text($(this).data('link'))
    });

    // Copy URL.
    var $clone_btn = $('#repo-clone-copy');
    $clone_btn.hover(function () {
        Gitea.bindCopy($(this));
    })
    $clone_btn.tipsy({
        fade: true
    });

    // Markdown preview.
    $('.markdown-preview').click(function() {
        var $this = $(this);
        $this.toggleAjax(function (resp) {
            $($this.data("preview")).html(resp);
        }, function () {
            $($this.data("preview")).html("no content");
        })
    });
}

// when user changes hook type, hide/show proper divs
function initHookTypeChange() {
    // web hook type change
    $('select#hook-type').on("change", function () {
        hookTypes = ['Gitea', 'Slack'];

        var curHook = $(this).val();
        hookTypes.forEach(function (hookType) {
            if (curHook === hookType) {
                $('div#' + hookType.toLowerCase()).toggleShow();
            }
            else {
                $('div#' + hookType.toLowerCase()).toggleHide();
            }
        });
    });
}

function initRepoRelease() {
    $('#release-new-target-branch-list li').click(function() {
        if (!$(this).hasClass('checked')) {
            $('#repo-branch-current').text($(this).text());
            $('#tag-target').val($(this).text());

            $(this).parent().find('.checked').removeClass('checked');
            $(this).addClass('checked');
        }
    })
}

function initRepoSetting() {
    // Options.
    // Confirmation of changing repository name.
    var $reponame = $('#repo_name');
    var $setting_form = $('#repo-setting-form');
    $('#change-reponame-btn').magnificPopup({
        modal: true,
        callbacks: {
            open: function () {
                if (($reponame.data('repo-name') == $reponame.val())) {
                    $.magnificPopup.close();
                    $setting_form.submit();
                }
            }
        }
    }).click(function () {
        if (($reponame.data('repo-name') != $reponame.val())) {
            e.preventDefault();
            return true;
        }
    });
    $('#change-reponame-submit').click(function () {
        $.magnificPopup.close();
        $setting_form.submit();
    });

    initHookTypeChange();

    // Transfer repository.
    $('#transfer-repo-btn').magnificPopup({
        modal: true
    });
    $('#transfer-repo-submit').click(function () {
        $.magnificPopup.close();
        $('#transfer-repo-form').submit();
    });

    // Delete repository.
    $('#delete-repo-btn').magnificPopup({
        modal: true
    });
    $('#delete-repo-submit').click(function () {
        $.magnificPopup.close();
        $('#delete-repo-form').submit();
    });

    // Collaboration.
    $('#repo-collab-list hr:last-child').remove();
    var $ul = $('#repo-collaborator').next().next().find('ul');
    $('#repo-collaborator').on('keyup', function () {
        var $this = $(this);
        if (!$this.val()) {
            $ul.toggleHide();
            return;
        }
        Gitea.searchUsers($this.val(), $ul);
    }).on('focus', function () {
        if (!$(this).val()) {
            $ul.toggleHide();
        } else {
            $ul.toggleShow();
        }
    }).next().next().find('ul').on("click", 'li', function () {
        $('#repo-collaborator').val($(this).find('.username').text());
        $ul.toggleHide();
    });
}

function initOrgSetting() {
    // Options.
    // Confirmation of changing organization name.
    var $orgname = $('#orgname');
    var $setting_form = $('#org-setting-form');
    $('#change-orgname-btn').magnificPopup({
        modal: true,
        callbacks: {
            open: function () {
                if (($orgname.data('orgname') == $orgname.val())) {
                    $.magnificPopup.close();
                    $setting_form.submit();
                }
            }
        }
    }).click(function () {
        if (($orgname.data('orgname') != $orgname.val())) {
            e.preventDefault();
            return true;
        }
    });
    $('#change-orgname-submit').click(function () {
        $.magnificPopup.close();
        $setting_form.submit();
    });

    // Confirmation of delete organization.
    $('#delete-org-btn').magnificPopup({
        modal: true
    }).click(function (e) {
        e.preventDefault();
        return true;
    });
    $('#delete-org-submit').click(function () {
        $.magnificPopup.close();
        $('#delete-org-form').submit();
    });

    initHookTypeChange();
}

function initInvite() {
    // Invitation.
    var $ul = $('#org-member-invite-list');
    $('#org-member-invite').on('keyup', function () {
        var $this = $(this);
        if (!$this.val()) {
            $ul.toggleHide();
            return;
        }
        Gitea.searchUsers($this.val(), $ul);
    }).on('focus', function () {
        if (!$(this).val()) {
            $ul.toggleHide();
        } else {
            $ul.toggleShow();
        }
    }).next().next().find('ul').on("click", 'li', function () {
        $('#org-member-invite').val($(this).find('.username').text());
        $ul.toggleHide();
    });
}

function initOrgTeamCreate() {
    // Delete team.
    $('#org-team-delete').magnificPopup({
        modal: true
    }).click(function (e) {
        e.preventDefault();
        return true;
    });
    $('#delete-team-submit').click(function () {
        $.magnificPopup.close();
        var $form = $('#team-create-form');
        $form.attr('action', $form.data('delete-url'));
    });
}

function initTeamMembersList() {
    // Add team member.
    var $ul = $('#org-team-members-list');
    $('#org-team-members-add').on('keyup', function () {
        var $this = $(this);
        if (!$this.val()) {
            $ul.toggleHide();
            return;
        }
        Gitea.searchUsers($this.val(), $ul);
    }).on('focus', function () {
        if (!$(this).val()) {
            $ul.toggleHide();
        } else {
            $ul.toggleShow();
        }
    }).next().next().find('ul').on("click", 'li', function () {
        $('#org-team-members-add').val($(this).find('.username').text());
        $ul.toggleHide();
    });
}

function initTeamRepositoriesList() {
    // Add team repository.
    var $ul = $('#org-team-repositories-list');
    $('#org-team-repositories-add').on('keyup', function () {
        var $this = $(this);
        if (!$this.val()) {
            $ul.toggleHide();
            return;
        }
        Gitea.searchRepos($this.val(), $ul, 'uid=' + $this.data('uid'));
    }).on('focus', function () {
        if (!$(this).val()) {
            $ul.toggleHide();
        } else {
            $ul.toggleShow();
        }
    }).next().next().find('ul').on("click", 'li', function () {
        $('#org-team-repositories-add').val($(this).text());
        $ul.toggleHide();
    });
}

function initAdmin() {
    // Create account.
    $('#login-type').on("change", function () {
        var v = $(this).val();
        if (v.indexOf("0-") + 1) {
            $('.auth-name').toggleHide();
            $(".pwd").find("input").attr("required", "required")
                .end().toggleShow();
        } else {
            $(".pwd").find("input").removeAttr("required")
                .end().toggleHide();
            $('.auth-name').toggleShow();
        }
    });

    // Delete account.
    $('#delete-account-btn').magnificPopup({
        modal: true
    }).click(function (e) {
        e.preventDefault();
        return true;
    });
    $('#delete-account-submit').click(function () {
        $.magnificPopup.close();
        var $form = $('#user-profile-form');
        $form.attr('action', $form.data('delete-url'));
    });

    // Create authorization.
    $('#auth-type').on("change", function () {
        var v = $(this).val();
        if (v == 2) {
            $('.ldap').toggleShow();
            $('.smtp').toggleHide();
            $('.pam').toggleHide();
        }
        if (v == 3) {
            $('.smtp').toggleShow();
            $('.ldap').toggleHide();
            $('.pam').toggleHide();
        }
        if (v == 4) {
            $('.pam').toggleShow();
            $('.smtp').toggleHide();
            $('.ldap').toggleHide();
        }
    });

    // Delete authorization.
    $('#delete-auth-btn').magnificPopup({
        modal: true
    }).click(function (e) {
        e.preventDefault();
        return true;
    });
    $('#delete-auth-submit').click(function () {
        $.magnificPopup.close();
        var $form = $('#auth-setting-form');
        $form.attr('action', $form.data('delete-url'));
    });
}

function initInstall() {
    // Change database type.
    (function () {
        var mysql_default = '127.0.0.1:3306';
        var postgres_default = '127.0.0.1:5432';

        $('#install-database').on("change", function () {
            var val = $(this).val();
            if (val != "SQLite3") {
                $('.server-sql').show();
                $('.sqlite-setting').addClass("hide");
                if (val == "PostgreSQL") {
                    $('.pgsql-setting').removeClass("hide");

                    // Change the host value to the Postgres default, but only
                    // if the user hasn't already changed it from the MySQL
                    // default.
                    if ($('#database-host').val() == mysql_default) {
                        $('#database-host').val(postgres_default);
                    }
                } else if (val == 'MySQL') {
                    $('.pgsql-setting').addClass("hide");
                    if ($('#database-host').val() == postgres_default) {
                        $('#database-host').val(mysql_default);
                    }
                } else {
                    $('.pgsql-setting').addClass("hide");
                }
            } else {
                $('.server-sql').hide();
                $('.pgsql-setting').hide();
                $('.sqlite-setting').removeClass("hide");
            }
        });
    }());
}

function initProfile() {
    // Avatar.
    $('#profile-avatar').tipsy({
        fade: true
    });
}

function initTimeSwitch() {
    // Time switch.
    $(".time-since[title]").on("click", function () {
        var $this = $(this);

        var title = $this.attr("title");
        var text = $this.text();

        $this.text(title);
        $this.attr("title", text);
    });
}

function initDiff() {
    $('.diff-detail-box>a').click(function () {
        $($(this).data('target')).slideToggle(100);
    })

    var $counter = $('.diff-counter');
    if ($counter.length < 1) {
        return;
    }
    $counter.each(function (i, item) {
        var $item = $(item);
        var addLine = $item.find('span[data-line].add').data("line");
        var delLine = $item.find('span[data-line].del').data("line");
        var addPercent = parseFloat(addLine) / (parseFloat(addLine) + parseFloat(delLine)) * 100;
        $item.find(".bar .add").css("width", addPercent + "%");
    });
}

$(document).ready(function () {
    Gitea.AppSubUrl = $('head').data('suburl') || '';
    initCore();
    if ($('#user-profile-setting').length) {
        initUserSetting();
    }
    if ($('#repo-create-form').length || $('#repo-migrate-form').length) {
        initRepoCreate();
    }
    if ($('#repo-header').length) {
        initTimeSwitch();
        initRepo();
    }
    if ($('#release').length) {
        initRepoRelease();
    }
    if ($('#repo-setting').length) {
        initRepoSetting();
    }
    if ($('#org-setting').length) {
        initOrgSetting();
    }
    if ($('#invite-box').length) {
        initInvite();
    }
    if ($('#team-create-form').length) {
        initOrgTeamCreate();
    }
    if ($('#team-members-list').length) {
        initTeamMembersList();
    }
    if ($('#team-repositories-list').length) {
        initTeamRepositoriesList();
    }
    if ($('#admin-setting').length) {
        initAdmin();
    }
    if ($('#install-form').length) {
        initInstall();
    }
    if ($('#user-profile-page').length) {
        initProfile();
    }
    if ($('#diff-page').length) {
        initTimeSwitch();
        initDiff();
    }
    if ($('#wiki-page-create-form').length) {
        var editor = new Editor();
        editor.render();
        initWikiCreatePage(editor);
    }
    if ($('#repo-wiki').length) {
        initWikiPage();
    }

    $('#dashboard-sidebar-menu').tabs();
    $('#pull-issue-preview').markdown_preview(".issue-add-comment");

    homepage();

    // Fix language drop-down menu height.
    var l = $('#footer-lang li').length;
    $('#footer-lang .drop-down').css({
        "top": (-31 * l) + "px",
        "height": (31 * l - 3) + "px"
    });
});

function homepage() {
    // Change method to GET if no username input.
    $('#promo-form').submit(function (e) {
        if ($('#username').val() === "") {
            e.preventDefault();
            window.location.href = Gitea.AppSubUrl + '/user/login';
            return true
        }
    });
    // Redirect to register page.
    $('#register-button').click(function (e) {
        if ($('#username').val() === "") {
            e.preventDefault();
            window.location.href = Gitea.AppSubUrl + '/user/sign_up';
            return true
        }
        $('#promo-form').attr('action', Gitea.AppSubUrl + '/user/sign_up');
    });
}

String.prototype.endsWith = function (suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

function initWikiPage() {
    $('.remove-wiki-page').click(function () {
        if (confirm('Are you sure?')) {
            var wiki = document.location.href.match(/([a-zA-Z0-9.:\/\/]+)\/wiki\/([a-z0-9]+)/);
            var url;
            if (wiki != null) {
              url = wiki[0] + '/remove';
            } else {
                wiki = document.location.href.match(/([a-zA-Z0-9.:\/\/]+)\/wiki/);
                url = wiki[0] + '/home/remove';
            }
            var redirectUrl = wiki[1] + '/wiki';
            $.ajax({
                url: url,
                data: {comment: $(this).data('id')},
                dataType: 'json',
                method: 'post',
                success: function (json) {
                    if (json.ok) {
                        document.location.href = redirectUrl;
                    } else {
                        alert(json.error);
                    }
                }
            });
        }
        return false;
    });

    $("#new-wiki-page").click(function () {
        var wiki = document.location.href.match(/([a-zA-Z0-9.:\/\/]+)\/wiki([\/a-z0-9]{0,})/);
        document.location.href = wiki[1] + "/wiki/new";
    });
}

function initWikiCreatePage(editor) {
    $('#wiki-page-create-form').submit(function () {
        var url = $(this).attr('action');
        data = $(this).serialize();
        data.content = editor.codemirror.getValue();
        $.ajax({
            url: url,
            data: data,
            dataType: "json",
            method: "post",
            success: function (json) {
                if (json.ok && json.data.length) {
                    document.location.href = json.data;
                } else {
                    $('#submit-error').html(json.error);
                }
            }
        });
        return false;
    });
}
