// ==UserScript==
// @name                Term Filter
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Aids the advisor to quickly distinguish between first and second long semester terms in Student Planner.
// @version             3.0
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==

// Helpful switches that can be turned on and off as needed (on = true, off = false)
const BANNED_WARNING_ENABLED    = true;
const COLOR_ALLOWED             = true;

// Color definitions used, provided that coloring is allowed
const COLOR_BANNED_CLASS    = "red";
const COLOR_BANNED_TEXT     = "white";
const COLOR_FIRST_TERM      = "peachpuff";
const COLOR_SECOND_TERM     = "powderblue";

// Here, you can define what you can type into the search box to filter for a specific term. '!' is preferred for speed.
const FILTER_IDENTIFIER_FIRST   = ["@1", "!1"];
const FILTER_IDENTIFIER_SECOND  = ["@2", "!2"];

// Information regarding the MutationObserver
var MutationObserver    = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
var observer            = new MutationObserver(spFix);
var obsConfig           = {childList: true,
                            subtree: true};

// For compatibility and security, we use an IIFE (Immediately invoked function expression)
(function() {
    "use strict";   // Makes the code "safer" to prevent us from using undeclared variables.

    /* Begin document observation */
    observer.observe(document, obsConfig);
}());

function spFix()
{
    // Color code the rows of the class schedule table
    if (COLOR_ALLOWED)  colorTable();

    // Filter the search schedule
    if ($(".search-nestedaccordionitem").length) {
        if (searchContains(FILTER_IDENTIFIER_FIRST))
            filterClasses(1);
        else if (searchContains(FILTER_IDENTIFIER_SECOND))
            filterClasses(2);

        // Grays out "banned" classes
        if (BANNED_WARNING_ENABLED)     shadeBannedClasses();
    }
}

/**
 *  Filters classes in the search menu to either disappear or to appear "banned" to the user.
 *  @param  termVal     Which 8-week term you want to search
 */
function filterClasses(termVal)
{
    $(".search-nestedaccordionitem").each(function (i) {
        var classBox = $(".search-nestedaccordionitem").eq(i);
        var classTitle = $.trim($(classBox).find("a").text());
        var section = classTitle.substring(classTitle.lastIndexOf(" ") + 1);

        // Check the 2nd character.
        var termId = parseInt(section.charAt(1), 10);

        if (termVal === 1) {
            if ((getSectionExt(section) === "WK") && ((termId !== 1) && (termId !== 3))) {
                if (!$(classBox).is(":hidden"))
                    $(classBox).detach();
            } else if (termId >= 3) {
                if (getSectionExt(section) !== "WK")
                    if (!$(classBox).is(":hidden"))
                        $(classBox).detach();
            }
        }
        else if (termVal === 2) {
            if ((getSectionExt(section) === "WK") && ((termId !== 2) && (termId !== 4))) {
                if (!$(classBox).is(":hidden"))
                    $(classBox).detach();
            } else if ((termId < 3) || (termId >= 5)) {
                if (getSectionExt(section) !== "WK")
                    if (!$(classBox).is(":hidden"))
                        $(classBox).detach();
            }
        }
    });
}

/**
 *  Colors the schedule on Student Planner, row by row
 */
function colorTable()
{
    // Get each of the rows
    var rows = $("table.esg-table.esg-table--no-mobile").find("tbody > tr");

    if (rows.length) {
        // For each row, grab data from each column
        $.each(rows, function (i, row) {
            colorRow($(row));
        });
    }
}

/**
 *  Colors the particular row in Student Planner
 *  @param  row    The row of the table
 */
function colorRow(row)
{
    const STYLE_ROW_SEPARATION  = "inset 0px 0px 5px rgba(0,0,0,0.5)";
    const STYLE_TERM_FIRST      = {"background-color":  COLOR_FIRST_TERM,
                                    "box-shadow":       STYLE_ROW_SEPARATION};
    const STYLE_TERM_SECOND     = {"background-color":  COLOR_SECOND_TERM,
                                    "box-shadow":       STYLE_ROW_SEPARATION};
    const STYLE_BANNED_CLASS    = {"background-color":  COLOR_BANNED_CLASS,
                                    "color":            COLOR_BANNED_TEXT,
                                    "font-weight":      "bold"};

    var section = getSection(row);

    if (section.length === 0)
        return;

    var termId = parseInt(section.charAt(1), 10);

    if (isBannedClass(section))
        $(row).css(STYLE_BANNED_CLASS);
    // Is it a Weekend section?
    else if (getSectionExt(section) === "WK") {
        // Is it during the 1st 8-weeks?
        if ((termId === 1) || (termId === 3))
            $(row).css(STYLE_TERM_FIRST);
        else
            $(row).css(STYLE_TERM_SECOND);
    } else {
        if (termId < 3)
            $(row).css(STYLE_TERM_FIRST);
        else if (termId < 5)
            $(row).css(STYLE_TERM_SECOND);
    }
}

function shadeBannedClasses()
{
    const STYLE_BANNED_SEARCH           = {"filter":"brightness(0.5)"};
    const STYLE_POTENTIALLY_BAD_SEARCH  = {"filter":"brightness(0.75) sepia(100%)"};
    // Here so that the banned classes are indicated in the search results if the user didn't specify @1 or @2
    $(".search-nestedaccordionitem").each(function (i) {
        var classBox = $(".search-nestedaccordionitem").eq(i);
        var classTitle = $.trim($(classBox).find("a").text());
        var section = classTitle.substring(classTitle.lastIndexOf(" ") + 1);

        if (isPotentiallyBadClass(section))
            $(classBox).css(STYLE_POTENTIALLY_BAD_SEARCH);
        else if (isBannedClass(section))
            $(classBox).css(STYLE_BANNED_SEARCH);
    });
}

/**
 *  Determines if the search box contains one of the identifiers provided
 *  @param identifiers
 */
function searchContains(IDENTIFIERS)
{
    var $inputBox = $("#keyword");
    for (const i in IDENTIFIERS) {
        if ($inputBox.val().includes(IDENTIFIERS[i]))
            return true;
    }
    return false;
}

/**
 *  Locates and return the section code from the given row in Student Planner
 *  @param row  Row in Student Planner
 */
function getSection(row)
{
    const COURSE_TEXT_COLUMN = 2;
    var columns = $(row).find("td");

    // Find the first instance of the ":"
    var courseText = $.trim($(columns).eq(COURSE_TEXT_COLUMN).text());
    var courseInfoStr = courseText.substring(0, courseText.indexOf(":")).replace(/-/g,"_");

    if (courseInfoStr.includes("_")) {
        var splitText = courseInfoStr.split("_");
        if (splitText.length === 3)
            return splitText.pop();
        else
            return "";
    }
    else
        return "";
}

/**
 *	Custom-built solution that helps the advisor see that the section they're registering the student
 *	for is a high school/alternative campus section. In most cases, this is a huge no-no unless they
 *	have permission from the department or instructor. There is a convenient flag that can be turned
 *	on or off as needed at the top of the script, however.
 *	@param   section     The section text, e.g. H31C
 *	@return              Whether or not it is a banned class, by section definition.
 */
function isBannedClass(section)
{
    var ext = getSectionExt(section);

    if (BANNED_WARNING_ENABLED) {
        var termId = parseInt(section.charAt(1), 10);

        if (isBannedExt(ext))
            return true;
        else if (termId > 7)     // According to the section codes cheatsheet, 80 - 89 is OCTECHS, 90-99 is Dual Credit
            return true
    }
    else return false;
}

/**
 *	Custom-built solution that helps the advisor see that the section they're registering the student
 *	for is potentially bad.
 *	@param   section     The section text, e.g. H31C
 *	@return              Whether or not it is a potentially bad class, by section definition.
 */
function isPotentiallyBadClass(section)
{
    var ext = getSectionExt(section);

    if (BANNED_WARNING_ENABLED) {
        if (isPotentiallyBadExt(ext))
            return true;
    }
    else return false;
}

/**
 *  Gets the section location extension from the section code.
 *  @param section  The section code for the course.
 */
function getSectionExt(section)
{
    const SECTION_STRING_INDEX = 3;     // In sections, e.g. H01C, the extension is the "3rd" character
    return section.substring(SECTION_STRING_INDEX);
}

/**
 *  Contained in the function are some course codes that are determined to be
 *  "off-limits" in terms of our registration process.
 *  @param ext  The section extension, e.g., C, CT, P, etc.
 *  @return     Boolean value regarding if the class fits at least one of the banned locations.
 */
function isBannedExt(ext)
{
    const BANNED_EXT_LIST   = [ "A",       // Andrews
                                "AC",      // Alternative Completion
                                "AL",      // Alpine
                                "B",       // OHS
                                "CH",      // City Hall
                                "CR",      // Crane
                                "CT",      // OCTECHS
                                "D",       // Presidio
                                "E",       // Pecos
                                "EC",      // ECISD Training Center
                                "HS",      // High school
                                "I",       // Imperial
                                "J",       // Ft. Davis
                                "K",       // Kermit
                                "L",       // Monahans
                                "M",       // McCamey
                                "MM",      // Marathon
                                "NT",      // New Tech
                                "P",       // Permian
                                "R",       // Region 18
                                "RM",      // Richard Milburn
                                "Q",       // Balmorhea
                                "RK",      // Rankin
                                "S",       // Seminole
                                "T",       // Terlingua
                                "V",       // Valentine
                                "W"];      // Wink

    return BANNED_EXT_LIST.includes(ext);
}

/**
 *  Contained in the function are some course codes that are determined to be
 *  "potentially bad" in terms of our registration process.
 *  @param ext  The section extension, e.g., C, CT, P, etc.
 *  @return     Boolean value regarding if the class fits at least one of the banned locations.
 */
function isPotentiallyBadExt(ext)
{
    const POTENTIALLY_BAD_LIST  = ["TT"];      // OC2UTPBt3

    return POTENTIALLY_BAD_LIST.includes(ext);
}
