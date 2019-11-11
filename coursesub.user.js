// ==UserScript==
// @name                Course Sub
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out the form for course substitutions.
// @version             3.0
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @include             https://*.edu*/current-students/records/faculty/AdvisorRequestCourseSub/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM.getValue
// @grant               GM.setValue
// @grant               GM.deleteValue
// ==/UserScript==

// You need to change the name and e-mail before using! For the MOVE_TO_NOTES_TAB, set as you like: (true = enabled, false = disabled)
const ADVISOR_NAME              = "CHANGETHISINTHESCRIPT";
const ADVISOR_EMAIL             = "CHANGETHISINTHESCRIPT@odessa.edu";
const MOVE_TO_NOTES_TAB_ENABLED = true;

// In the event that the URL for the course sub form/Student Planner changes, you will need to update this with the correct URLs.
// MAKE SURE THE LINK GOES IN BETWEEN THE QUOTES!!!
const URL_COURSE_SUB            = "https://www.odessa.edu/current-students/records/faculty/AdvisorRequestCourseSub/index.html";
const URL_SPFRAG                = "/Student/Planning/Advisors/Advise/";

// *DON'T* TOUCH
const URL_CURRENT = window.location.href;

// Information regarding the MutationObserver
var MutationObserver    = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
var observer            = new MutationObserver(mutationHandler);
var obsConfig           = {childList: true,
                            subtree: true,
                            attributes: true};

function mutationHandler() {
    spFix();
}

(function() {
    "use strict";

    // If we're on Student Planning...
    if (URL_CURRENT.includes(URL_SPFRAG))
        observer.observe(document, obsConfig);
    // Otherwise, do stuff when we're on the Major Change request page.
    else if (URL_CURRENT.includes(URL_COURSE_SUB))
        courseSubber();
}());

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                              Student Planning Functions                                  //
// All functions here should apply to Student Planning scraping (exclusively, if possible)  //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

// Places the course sub buttons in all the appropriate places when we're on the Progress tab
function spFix()
{
    if ($("#other-courses-table").length)
    {
        // Add selector menu to each row in the table
        if (!$.isEmptyObject(getCompletedClasses()))
        {
            // Create the "Apply Course Substitution" button if it doesn't already exist.
            if ($("#course-sub-button").length === 0)
            {
                // First, by cloning it and changing its behavior accordingly.
                var $courseSubBtn = $cloneBtn($("#whatif"));
                $courseSubBtn.html("Begin Course Substitution")
                                .attr("id", "course-sub-button");

                // Then, press the Course Sub button onto the page.
                $courseSubBtn.css({"float":"right"})                  // Puts the Change Major button in a more natural spot
                            .appendTo($("#other-courses-header-non-mobile"));

                // Reprograms the "Course Substitution Button" to take us to have dual functionality.
                $courseSubBtn.on("click", function () {
                    var $selector = makeSelector(getCompletedClasses());
                    prepareIncompleteRows($selector);

                    // Allows the button to flip from adding in the sub boxes to performing the autosubs.
                    $(this).off("click")
                            .on("click", initSub)
                            .html("Apply Course Substitutions");
                });
            }
        }
    }
}

/**
 *  Finds all of the rows NOT in the Other Courses table, and adds the Selector box to the last column of each row.
 *  @param $selector    The selector object generated from the Other Courses table.
 */
function prepareIncompleteRows($selector)
{
    var $rows = $(".esg-table-body__row");

    $.each($rows, function (i, row) {
        var $columns = $(row).find("td");

        try {
            if (isRequirementsRow($columns))
            {
                if (isSubstitutable($columns))
                {
                    var $lastCell = $columns.eq($columns.length - 1);

                    // Only put the selector box in the last column if one is NOT found.
                    if ($lastCell.find("select").length === 0)
                    {
                        // Keep information about the class identifiable
                        var text = $.trim($columns.eq(1).text());
                        $lastCell.html($selector.clone().attr("name", text));   // NEED the clone() here to generate a unique object for each!
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    });
}

/**
 *  Generates a JSON object containing the classes from the Other Courses table that are "completed".
 *  @return JSON object containing a list of each course from the Other Courses table.
 */
function getCompletedClasses()
{
    var result = {};

    var $ocRows = $("#other-courses-table").find("tr");

    $.each($ocRows, function (i, row) {
        var $columns = $(row).find("td");
        if (isSubstitutable($columns))
        {
            var key = $.trim($columns.eq(1).text());
            if (key !== "")
                result[key] = key;
        }
    });

    return result;
}

/**
 *  Generates the bulk data we need to pass into the Course Substitution
 *  form, such as the student's name, program, ID number, and so on.
 *  @return JSON object containing student data and course sub pairings.
 */
function generateData()
{
    var studentName = $.trim($("#user-profile-name").text());
    var studentIdText = $.trim($(".esg-person-card__detail").eq(1).text());
    var studentId = studentIdText.substring(studentIdText.lastIndexOf(" ") + 1);
    var currentMajor = $.trim($("#current-program-text").text());

    // All information needed to change the student's major
    return {
        "studentName"       : studentName,
        "studentId"         : studentId,
        "currentMajor"      : currentMajor,
        "coursePairings"    : generatePairings()
    };
}

/**
 *  Generates the Course Substitution pairings as indicated from the Selector boxes on the Progress tab.
 *  @return JSON object containing course-sub pairings.
 */
function generatePairings()
{
    const COURSE_SUBSTITUTION_LIMIT = 4;
    var result = {};

    $.each($(".sub-selector"), function (i, selector) {
        if($(selector).val() !== "default")
        {
            result[$(selector).attr("name")] = $(selector).val();;
        }
    });

    // If the user accidentally (or intentionally) selects more than four subs, inform them of their transgression.
    if (Object.keys(result).length > COURSE_SUBSTITUTION_LIMIT)
        alert(  "ERROR: You have indicated more than " + COURSE_SUBSTITUTION_LIMIT +
                " substitutions. Only " + COURSE_SUBSTITUTION_LIMIT + " can be done at once.\n" +
                "Click OK to continue with the first " + COURSE_SUBSTITUTION_LIMIT + " alphabetically.");
    return result;
}

/**
 *  Button functionality to send data over to the Course Substitution form.
 */
function initSub()
{
    GM.setValue("course-sub-data", JSON.stringify(generateData()));
    window.open(URL_COURSE_SUB, "_blank");

    // As a convenience, we swap to the Notes tab, because that's where we're likely to need to go next.
    if (MOVE_TO_NOTES_TAB_ENABLED)  moveToNotesTab();
}

/**
 *  Creates the Selector object used to pick the courses available for Course Substitution.
 *  @return Selector object.
 */
function makeSelector(classesObj)
{
    var selector = $("<select>", {
        "class":"sub-selector esg-form__input"
    })
    .css({"float":"right"})
    .append($("<option>").attr("value", "default").text(""));

    $.each(classesObj, function (val, text) {
        selector.append($("<option>")
            .attr("value", val)
            .text(text));
    });

    return selector;
}

/**
 *  Quickly moves the advisor over to the Notes tab in order to easily document any changes or submissions that may have been made.
 */
function moveToNotesTab()
{
    $("#notes-tab").find("a")[0].click();
    $("#advising-notes-compose-box").attr("placeholder", "PASTE RESULTS HERE.");
}

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                                Course-Sub Form Functions                                 //
//     All functions here should apply to the course sub form (exclusively, if possible)    //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Enters all of the information necessary to perform a course substitution into the webform.
 */
async function courseSubber()
{
    let COURSE_SUB_DATA = JSON.parse(await GM.getValue("course-sub-data", "{}"));
    GM.deleteValue("course-sub-data");

    if ($.isEmptyObject(COURSE_SUB_DATA))   return;

    // Now, fill out the form
    $("input[name='Advisor/Faculty Name']").val(ADVISOR_NAME);
    $("input[name='email']").val(ADVISOR_EMAIL);
    $("input[name='Student Name']").val(COURSE_SUB_DATA.studentName);
    $("input[name='Student OC ID Number']").val(COURSE_SUB_DATA.studentId);
    $("input[name='Name of Program']").val(COURSE_SUB_DATA.currentMajor);

    // Warn the user that they forgot to edit their name and such in the script
    if ($("input[name='Advisor/Faculty Name']").val() === "CHANGETHISINTHESCRIPT")
        highlightGroup($("input[name='Advisor/Faculty Name']"));
    if ($("input[name='email']").val() === "CHANGETHISINTHESCRIPT@odessa.edu")
        highlightGroup($("input[name='email']"));

    var isDegree = !COURSE_SUB_DATA.currentMajor.includes("Cert");

    // We need to also determine if the new major is a certificate or not
    if (isDegree)
    {
        $("input[type='checkbox'][name='Degree']").prop("checked", true);
    }
    else
    {
        // If it is a certificate, what level is it?
        var certificateLevel = parseInt($.trim(COURSE_SUB_DATA.currentMajor).slice(-1), 10);

        if (certificateLevel === 2)
            $("input[type='checkbox'][name='Certificate Level 2']").prop("checked", true);
        else
            $("input[type='checkbox'][name='Certificate Level 1']").prop("checked", true);

    }

    // Highlight the graduation section because there's no way for us to get that
    highlightGroup($("input[name='Anticipated graduation semester and year']"));

    // Lastly, insert the course substitution data...
    fillSubForms(COURSE_SUB_DATA,
        $("input[name='Course Rubric']"),
        $("input[name='Course Rubric/Number/Name to Substitute']"));
}

/**
 *  Fills out the sub form with the appropriate data in the correct place.
 */
function fillSubForms(COURSE_SUB_DATA, $courseRubricList, $courseSubstituteList)
{
    var keys = Object.keys(COURSE_SUB_DATA.coursePairings);
    var values = Object.values(COURSE_SUB_DATA.coursePairings);

    $.each(keys, function(i, key) {
        $courseRubricList.eq(i).val(key);
    });
    $.each(values, function(i, value) {
        $courseSubstituteList.eq(i).val(value);
    });
}

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                                  Utility Functions                                       //
//            Small code snippets that are vital, but hidden to prevent confusion           //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

/**
 *  Determines if a row describes a substitutable course based on the column information.
 *  @return boolean
 */
function isSubstitutable($columns)
{
    const VALID_LIST   = ["group-notstarted",
                            "group-completed",
                            "group-inprogress",
                            "group-preregistered",
                            "group-planned"];

    for (var i = 0; i < VALID_LIST.length; i++)
        if ($columns.eq(0).hasClass(VALID_LIST[i]))
            return true;
    return false;
}

/**
 *  Determines if the row is a "Requirements" row, versus a class on the schedule or the OC courses table, based on its column information.
 *  @return boolean
 */
function isRequirementsRow($columns)
{
    return $columns.closest("table").attr("id") !== "other-courses-table";
}

/**
 *  Highlights a grouping in pink to draw the user's attention to it, such as not having changed the information in the ADVISOR_NAME field.
 */
function highlightGroup($group)
{
    $group.css("background-color", "pink");
}

/**
 *  Clones a given button with all of its frills removed.
 *  @return  Cloned jQuery object button
 */
function $cloneBtn($btn)
{
    var $adjustedBtn = $btn.clone()
                            .off()
                            .attr("href", null)
                            .removeAttr("data-bind");   // Student Planner places the click event in data-bind
    return $adjustedBtn;
}
