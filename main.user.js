// ==UserScript==
// @name                Advising Tools
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         A collection of advising tools, designed to simplify and automate a lot of the tedium at Odessa College.
// @version             0.1
// @include             https://*.edu*/UI/home/*
// @include             https://*.edu/*advisor-major-change-request/*
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM_info
// @grant               GM.getValue
// @grant               GM.setValue
// ==/UserScript==

var observer = new MutationObserver( function (mutations, mi)
{

});

/* Begin document observation */
observer.observe(document,	{
                                childList: true,
                                subtree: true
							}
);
