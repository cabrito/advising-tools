// ==UserScript==
// @name                Autoregform
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out registration forms with the click of a button!
// @version             1.7
// @include             https://*.edu*/UI/home/*
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM_info
// @grant               GM.getValue
// @grant               GM.setValue
// ==/UserScript==

// Helpful switches that can be enabled and disabled as-needed.
const STILL_ON_EIGHT_WEEKS_SYSTEM   = true;
const FIX_TYPOS_ENABLED             = true;
const STUDENT_PLANNER_URLFRAG       = "/Student/Planning/Advisors/Advise/";     // Fragment of URL used in Student Planner
const PRETEXT_BREAKER    = "Class Key  | Course | Number | Section |   Time & Day   | Instructor";
const POSTTEXT_BREAKER   = "----------------------";

// Constants related to the table columns
const COURSE_TITLE = 2;
const TIME = 5;
const LOCATION = 6;

// Holds the information that we'll pass between Student Planner and Colleague
var scheduleResult =    {
                            studentId       : 0,
                            semester        : "",
                            scheduleArray   : []
                        };
// Lighter solution than hanging onto the scheduleResult JSON Object.
var isDataAvailable = false;

/**
 *  The core of the logic to make appropriate changes to the document.
 */
var observer = new MutationObserver(
function (mutations, mi)
{
    // If we're on Student Planner...
    if (window.location.href.indexOf(STUDENT_PLANNER_URLFRAG) !== -1)
    {
        spFix();
    }
    // Otherwise, we're in Colleague.
    else
    {
        GM.getValue("currentSchedule", null).then(function (value) {
            if (value !== null)
            {
                scheduleResult = JSON.parse(value);
                GM.setValue("currentSchedule", null);
            }
        });
        colleagueFix();
    }
});

function colleagueFix()
{
  	if ($("#btn_close_report_browser").length > 0)
    {
      	$("#btn_close_report_browser").on("click", function () {
            if ($("#dataWindow").length > 0)
            {
                $("#dataWindow").remove();
            }
        });
    }

    if (scheduleResult.studentId !== 0)
    {
        // Exclusive to registration forms
        if ($("#popup-lookup").length > 0)
        {
            var edited = $("#popup-lookup").attr("edited");
            if (typeof edited === "undefined")
            {
                $("#popup-lookup").attr("edited", "true");
                $("#popup-lookup").trigger("click");
                $("#popup-lookup").trigger("compositionstart");
                $("#popup-lookup").trigger("input");
                $("#popup-lookup").trigger("compositionend");
                $("#popup-lookup").val(scheduleResult.studentId);
            }
        }

        // Exclusive to registration forms
        if ($("#JS-VAR1").length > 0)
        {
            var edited = $("#JS-VAR1").attr("edited");
            if (typeof edited === "undefined")
            {
                $("#JS-VAR1").attr("edited", "true");
                $("#JS-VAR1").trigger("click");
                $("#JS-VAR1").trigger("compositionstart");
                $("#JS-VAR1").trigger("input");
                $("#JS-VAR1").trigger("compositionend");
                $("#JS-VAR1").val(scheduleResult.semester);
            }
        }

        if ($("#report-browser-pre-text").length > 0)
        {
            var data = $("#report-browser-pre-text").val();

          	if (data.indexOf(PRETEXT_BREAKER) !== -1)
            {
                // Make the iframe...
                $("<iframe>", {
                    id:  "dataWindow",
                    frameborder: 0
                }).appendTo("body");
                var iframe = $("#dataWindow");

                $(iframe).ready(function () {
                    // Put the data into the iframe.
                    $("<pre>", {
                        id:  "textData",
                        style: "border: none",
                    }).appendTo($(iframe).contents().find("body"));

                    formatRegForm(iframe, data);

                    $(iframe).get(0).contentWindow.print();
                });
            }
            scheduleResult.studentId = 0;
        }
    }
}

function spFix()
{
    if ($("#print-schedule").length > 0)
    {
        if ($("#generate-regdata").length === 0)
        {
            var adjustedBtn = $cloneBtn($("#print-schedule")).attr("id", "generate-regdata");
            $(adjustedBtn).text("Generate Regform Data");
            $(adjustedBtn).insertAfter("#print-schedule");
            adjustedBtn.on("click", function () {
                try {
                    parseTable();
                } catch (error) {
                    console.error(error);
                    alert("ERROR: Could not read classes from table! (Did you plan everything to the section level?)");
                }
            });
        }
    }
}

function parseTable()
{
    // Get each of the rows
    var rows = $("table.esg-table.esg-table--no-mobile").find("tbody > tr");

    // Start creating our schedule
    scheduleResult.studentId = parseId();
    scheduleResult.semester = parseTerm();
    scheduleResult.scheduleArray = [];

    // For each row, grab data from each column
    $.each(rows, function (i, row) {
        var courseInfoArr = generateCourseInfoArray(row);

        if(courseInfoArr.length > 0)
        {
            try {
                scheduleResult.scheduleArray.push({
                    "code"          : courseInfoArr[0],
                    "number"        : courseInfoArr[1],
                    "section"       : courseInfoArr[2],
                    "daysAndTime"   : {"lecture": parseTimes(row)[0], "lab": parseTimes(row)[1]},
                    "term"          : parseTerm() + parseEightWeeksTerm(generateCourseInfoArray(row)[2])
                });
            } catch (error) {
                console.error(error);
                console.log("Row was not planned to the section level; Row will not be added to regform.");
            }
        }
    });
    GM.setValue("currentSchedule", JSON.stringify(scheduleResult)).then(function() {
        console.log("Sent over data to Colleague.");
    });
}

function createRegTable()
{
    var table = $("<table>").css(
        {"width":"100%",
        "text-align":"center",
        "border-style":"dotted",
        "border-width":"thin",
        "border-collapse":"collapse"});
    var header = $("<thead>").html(
        "<th>Course</th>" +
        "<th>Number</th>" +
        "<th>Section</th>" +
        "<th>Time & Day</th>" +
        "<th>Term</th>"
    );
    header.appendTo(table);

    var tbody = $("<tbody>");

    // Fill out the table
    $.each(scheduleResult.scheduleArray, function (i, course) {
        var row = $("<tr>").html(
            "<td>" + course.code + "</td>" +
            "<td>" + course.number + "</td>" +
            "<td>" + course.section + "</td>" +
            "<td>" + course.daysAndTime.lecture + "<br>" + course.daysAndTime.lab +"</td>" +
            "<td>" + course.term +"</td>"
        );
        row.appendTo(tbody);
    });
    tbody.appendTo(table);
    $(table).find("td, th").css({"border-style":"dashed","border-width":"thin"});
    return table;
}

function isOnline(row)
{
    var columns = $(row).find("td");
    if (~$.trim($(columns).eq(LOCATION).text()).indexOf("Web L"))
        return true;
    else
        return false;
}

function generateCourseInfoArray(row)
{
    var columns = $(row).find("td");
    // Find the first instance of the ":"
    var courseText = $.trim($(columns).eq(COURSE_TITLE).text());
    var courseInfoStr = courseText.substring(0, courseText.indexOf(":")).replace(/-/g,"_");

    if (courseInfoStr.indexOf("_") !== -1)
        return courseInfoStr.split("_");
    else
      	return [];
}

function parseId()
{
    var str = $($("#user-profile-details").find("p")[1]).text();
    return $.trim(str.substring(str.indexOf(":") + 1));
}

function parseTimes(row)
{
    if (isOnline(row))
        return ["WEB", ""];

    var columns = $(row).find("td");
    var divArr = $(columns).eq(TIME).find("div");

    var result = [];

    $.each(divArr, function (k) {
        var timeAndDateLine = $(divArr).eq(k);
        var meetTime = $.trim($(timeAndDateLine).text());

        if ((meetTime.indexOf("/") === -1) && (meetTime !== ""))
            result.push(meetTime);
    });

    if (result.length === 1)
        result.push("");
    return result;
}

function parseEightWeeksTerm(section)
{
    var termText = $.trim($("#schedule-activeterm-text").text());
    var semester = termText.substring(0, termText.lastIndexOf(" "));
    var termNumber = parseInt(section.charAt(1));

    if ((semester === "Fall") || (semester === "Spring"))
    {
      	// Are we still on the 8-week system? (For future-proofing)
      	if (STILL_ON_EIGHT_WEEKS_SYSTEM)
        {
            // Is it a Weekend section?
            if (section.indexOf("WK") !== -1)
            {
                // Is it during the 1st 8-weeks?
                if ((termNumber === 1) || (termNumber === 3))
                    return "1";
                else
                    return "2";
            }
            else
            {
                if (termNumber < 3)
                    return "1";
                else if (termNumber < 5)
                    return "2";
                else
                    return "";
            }
        }
      	else
        {
          	return "";
        }
    }
  	else
    {
      	return "";
    }
}

function parseTerm()
{
    var termText = $.trim($("#schedule-activeterm-text").text());
    var semester = termText.substring(0, termText.lastIndexOf(" "));
    var year     = termText.substring(termText.lastIndexOf(" "));
    var yearShort = year.substring(year.length - 2);

    switch (semester)
    {
        case "Spring":      return yearShort + "/SP";
        case "MayMester":   return yearShort + "/MM";
        case "Summer I":    return yearShort + "/S1";
        case "Summer II":   return yearShort + "/S2";
        case "Fall":        return yearShort + "/FA";
        case "Mid-Winter":
            yearShort = year.substring(year.indexOf("-") - 2, year.indexOf("-"));   // For Mid-Winter, the year is accessed differently.
            return yearShort + "/MW";
        default:            return "Error";                                         // THIS SHOULD NEVER HAPPEN!!!
    }
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

function formatRegForm(iframe, data)
{
    // If there are any typos we wish to fix, we fix them here.
    if (FIX_TYPOS_ENABLED)  data = fixTypos(data);

    var preText = data.substring(0, data.indexOf(PRETEXT_BREAKER));
    var postText = data.substring(data.lastIndexOf(POSTTEXT_BREAKER + POSTTEXT_BREAKER.length + 1);

    $(iframe).contents().find("#textData").text(preText);
    createRegTable().appendTo($(iframe).contents().find("body"));

    // Put the data into the iframe.
    $("<pre>", {
        id:  "textDataPost",
        style: "border: none",
    }).appendTo($(iframe).contents().find("body"));

    $(iframe).contents().find("#textDataPost").text(postText);
}

function fixTypos(data)
{
    // We pair the words such that the misspelling is on the left, and the correct spelling is on the right.
    var wordPairs = ["Menengitis",  "Meningitis",
                     "adivce",      "advice"];
    // Replace each instance of a misspelled word with the correct spelling in the data
    for (i = 1; i < wordPairs; i+=2)
        data.replace(wordPairs[i - 1], wordPairs[i]);
    return data;
}

/* Begin document observation */
observer.observe(document,	{
                                childList: true,
                                subtree: true
							}
);
