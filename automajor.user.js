// ==UserScript==
// @name                Automajor
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out the Change Major form
// @version             4.0
// @include             https://*.edu/Student/Planning/Advisors/Advise/*
// @include             https://*.edu/*advisor-major-change-request/*
// @exclude             https://*edu*.tld
// @require             https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @grant               GM.info
// @grant               GM.getValue
// @grant               GM.setValue
// @grant               GM.deleteValue
// ==/UserScript==

// *DON'T* TOUCH unless you know what you're doing!
const PREFERENCES = getPreferences();
const URL_SPFRAG  = "/Student/Planning/Advisors/Advise/";
const URL_CURRENT = window.location.href;

// Information regarding the MutationObserver
var MutationObserver    = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
var observer            = new MutationObserver(mutationHandler);
var obsConfig           = {childList: true,
                            subtree: true};

function mutationHandler() {
    spFix();
}

// For compatibility and security, we use an IIFE (Immediately invoked function expression)
(async function() {
    "use strict";   // Makes the code "safer" to prevent us from using undeclared variables.

    // If we're on Student Planner...
    if (URL_CURRENT.includes(URL_SPFRAG)) {
        observer.observe(document, obsConfig);
    }

    // Otherwise, do stuff when we're on the Major Change request page.
    else majorChanger();
}());

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                              Student Planning Functions                                   //
//  All functions here should apply to Student Planner scraping (exclusively, if possible)  //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

// In certain instances such as when working with a Visiting Student, there is
// no "Load Sample Course Plan" button permitted. We employ a failsafe for such
// a situation by putting the "Change to this Major" button in a different spot.
function spFix()
{
    var $whatIfBtn = $("#whatif");
    var $progNotes = $("#get-evaluation-notices-link");

    // If we're on the "Progress" tab...
    if ($whatIfBtn.length) {
        // Create the "Change to this Major" button if it doesn't already exist.
        if (!$("#change-major-button").length) {
            // If the sample course plan button exists, replace it
            var $sampleCoursePlanBtn = $("#load-sample-plan-button");

            // First, by cloning it and changing its behavior accordingly.
            var $changeMajorBtn = $cloneBtn($whatIfBtn);
            $changeMajorBtn.html("Change to this Major")
                            .attr("id", "change-major-button");

            // Reprograms the "Change to this Major button" to take us to the major-change request form.
            $changeMajorBtn.on("click", function () {
                if ($.isEmptyObject(PREFERENCES)) {
                    alert("WARNING! Advisor preferences not set! Cannot continue.");
                    return;
                }
                if (!PREFERENCES.urls.majorChange.length) {
                    alert("WARNING! URL for major change form not set in preferences!");
                    return;
                }
                GM.setValue("major-change-data", JSON.stringify(generateData()));
                window.open(PREFERENCES.urls.majorChange, "_blank");

                // As a convenience, we swap to the Notes tab, because that's where we're likely to need to go next.
                if (PREFERENCES.personal.autoNotes)  moveToNotesTab();
            });

            // Then, press the Change Major button onto the page.
            $changeMajorBtn.css({"float":"right"})                  // Puts the Change Major button in a more natural spot
                            .insertAfter("#current-program");
        }
    }
}

/* Produces all of the data necessary to pass over to the Major Change form */
function generateData()
{
    var studentName = $.trim($("#user-profile-name").text());
    var studentIdText = $.trim($(".esg-person-card__detail").eq(1).text());
    var studentId = studentIdText.substring(studentIdText.lastIndexOf(" ") + 1);
    var currentMajor = getCurrentMajor();
    var newMajor = $.trim($("#current-program-text").text());
    var newMajorAdj = newMajor.substring(0, newMajor.lastIndexOf("("));
    var newMajorCode = newMajor.substring(newMajor.lastIndexOf("(") + 1, newMajor.lastIndexOf(")"));

    // All information needed to change the student's major
    return {
        studentName  : studentName,
        studentId    : studentId,
        currentMajor : currentMajor,
        newMajor     : newMajorAdj.length > 0 ? newMajorAdj : newMajor,
        newMajorCode : newMajorCode.length > 0 ? newMajorCode : "N/A",
        preferences  : PREFERENCES
    };
}

/* Grabs the student's major in a context-aware manner. */
function getCurrentMajor()
{
    var $programList = $(".esg-person-card__list-item");

    // Scroll through the list and find the first non-UG or non-CE major
    for (var i = 1; i <= $programList.length - 1; i++) {
        var iProgramText = $.trim($programList.eq(i).text());
        if (isValidMajor(iProgramText))
                return iProgramText;
    }
    return "NO ACTIVE MAJOR";
}

/**
 *  Compares the given line of text to those that are identified as invalid majors.
 *  @param text Program-related text.
 *  @return     Boolean value whether the line of text appears in a list of invalid options.
 */
function isValidMajor(text)
{
    const nonmajorList =   ["(CE)",                 // The Records office has not been consistent with Continuing Education
                            "CE",                   // indications on a student's record. Hence we need to have both of these.
                            "(UG)",
                            "UG",
                            "Educational Goal"];    // Nasty hack due to some students having no educational goal declared.
    return !nonmajorList.includes(text);
}

function getPreferences()
{
    let prefs = localStorage.getItem("preferences");
    return JSON.parse(prefs) || {};
    // return JSON.parse(await GM.getValue("preferences", "{}"));
}

/**
 *  Inserts a tooltip after the selected element
 *  @param msg  The message to display to the user.
 *  @return jQuery object for chaining
 */
function insertTooltip(msg, selector)
{
    let unixTime = Date.now();
    if ($("#tooltip-" + unixTime).length)   $("#tooltip-" + unixTime).remove();
    const STYLE_TOOLTIP = {"font-weight":"bold",
                            "color":"#ff0000"};
    return $("<p>", {
        id:  "tooltip-" + unixTime
    }).css(STYLE_TOOLTIP)
    .insertAfter($(selector))
    .text(msg);
}

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                              Major-Change Form Functions                                 //
//    All functions here should apply to the major change form (exclusively, if possible)   //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

/* Handles the logic required for changing the student's major on the webform. */
async function majorChanger()
{
    let MAJOR_CHANGE_DATA = JSON.parse(await GM.getValue("major-change-data", "{}"));
    GM.deleteValue("major-change-data");

    if ($.isEmptyObject(MAJOR_CHANGE_DATA)) return;

    console.log(JSON.stringify(MAJOR_CHANGE_DATA));

    // Now, fill out the form
    $("[id='Advisor Name']").val(MAJOR_CHANGE_DATA.preferences.personal.username);
    $("[name='email']").val(MAJOR_CHANGE_DATA.preferences.personal.email);
    $("[id='Student Name']").val(MAJOR_CHANGE_DATA.studentName);
    $("[id='OC ID #']").val(MAJOR_CHANGE_DATA.studentId);
    $("[name='Current Major']").val(MAJOR_CHANGE_DATA.currentMajor);
    $("[id='New Major']").val(MAJOR_CHANGE_DATA.newMajor);
    $("[id='New Major Code']").val(MAJOR_CHANGE_DATA.newMajorCode);

    // Warn the user that they forgot to edit their name and such in the script
    if ($("[id='Advisor Name']").val().length === 0)
        highlightGroup($("[id='Advisor Name']"));
    if ($("[name='email']").val().length === 0)
        highlightGroup($("[name='email']"));

    var isDegree = !MAJOR_CHANGE_DATA.newMajor.includes("Cert");

    // We need to also determine if the new major is a certificate or not
    if (isDegree) {
        $("input[type='radio'][value='Degree']").prop("checked", true);

        // The ability to check the TSI status (or future equivalent)
        // is not currently implemented. The only known way to find this
        // information in Student Planner is via the "Show Program Notes"
        // in the "Progress" tab. The hope is to implement this in the
        // future.

        // Find "TSI Passed?" section
        var $controlGroups = $("div[class='control-group']");
        for (var i = 0; i < $controlGroups.length; i++) {
            var $group = $controlGroups.eq(i);
            if ($group.text().includes("TSI Passed?"))
                highlightGroup($group);
        }
    } else {
        // If it is a certificate, what level is it?
        var certificateLevel = parseInt($.trim(MAJOR_CHANGE_DATA.newMajor).slice(-1), 10);

        if (certificateLevel === 2)
            $("input[type='radio'][value='Certificate Level 2']").prop("checked", true);
        else
            $("input[type='radio'][value='Certificate Level 1']").prop("checked", true);

        // Since certificates do not require TSI, go ahead and tick "N/A"
        $("input[type='radio'][name='TSI Passed?'][value='N/A']").prop("checked", true);
    }

    // Lastly, insert the password
    $("[id='Password']").val(MAJOR_CHANGE_DATA.preferences.personal.advPass);
}

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                                  Utility Functions                                       //
//            Small code snippets that are vital, but hidden to prevent confusion           //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

function moveToNotesTab()
{
    $("#notes-tab").find("a")[0].click();
    $("#advising-notes-compose-box").attr("placeholder", "PASTE RESULTS HERE.");
}

function highlightGroup($group)
{
    $group.css("background-color", "pink");
}

/* Clones the given button */
function $cloneBtn($btn)
{
    var $adjustedBtn = $btn.clone()
                            .off()
                            .attr("href", null)
                            .removeAttr("data-bind");   // Student Planner places the click event in data-bind
    return $adjustedBtn;
}
