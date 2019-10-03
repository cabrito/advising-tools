// ==UserScript==
// @name                Autoregform
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out registration forms with the click of a button!
// @version             2.0
// @include             https://*.edu*/UI/home/*
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM.getValue
// @grant               GM.setValue
// ==/UserScript==

// For compatibility and security, we use an IIFE (Immediately invoked function expression)
(function() {
    "use strict";       // Makes the code "safer" to prevent us from using undeclared variables.

    // Helpful switches that can be enabled and disabled as-needed.
    const STILL_ON_EIGHT_WEEKS_SYSTEM   = true;
    const FIX_TYPOS_ENABLED             = true;
    const URL_SPFRAG                    = "/Student/Planning/Advisors/Advise/";     // Fragment of URL used in Student Planner
    const PRETEXT_BREAKER               = "Class Key  | Course | Number | Section |   Time & Day   | Instructor";
    const POSTTEXT_BREAKER              = "----------------------";

    var scheduleResult = {};

    /**
     *  The core of the logic to make appropriate changes to the document.
     */
    var observer = new MutationObserver(function (mutations, mi) {
        try {
            // If we're on Student Planner...
            if (window.location.href.indexOf(URL_SPFRAG) >= 0)
            {
                spFix();
            }
            // Otherwise, we're in Colleague.
            else
            {
                GM.getValue("currentSchedule", null).then(function(value) {
                    if (value !== null)
                        scheduleResult = JSON.parse(value);
                    GM.setValue("currentSchedule", null);
                });
                colleagueFix();
            }
        } catch (error) {
            console.error(error);
        }
    });

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                              Student Planner Functions                                   //
    //  All functions here should apply to Student Planner scraping (exclusively, if possible)  //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    function spFix()
    {
        if ($("#print-schedule").length)
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
                        alert("ERROR: Unable to read classes from table! (Did you plan everything to the section level?)");
                    }
                });
            }
        }
    }

    // Constants related to the table columns. *DON'T TOUCH*, unless you know what you're doing.
    const COURSE_TITLE = 2;
    const TIME = 5;
    const LOCATION = 6;

    function parseTable()
    {
        // Get each of the rows
        var rows = $("table.esg-table.esg-table--no-mobile").find("tbody > tr");

        // Start creating our schedule
        scheduleResult =        {
                                    studentId       : parseId(),
                                    semester        : parseTerm(),
                                    scheduleArray   : []
                                };

        // For each row, grab data from each column
        $.each(rows, function (i, row) {
            var courseInfoArr = generateCourseInfoArray(row);

            if(courseInfoArr.length)
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
            console.log("Sent data over to Colleague.");
        });
    }

    /**
     *  Decides whether the given class row is an online class.
     *  @param row  Row from the class schedule table.
     *  @return boolean
     */
    function isOnline(row)
    {
        var columns = $(row).find("td");
        if (~$.trim($(columns).eq(LOCATION).text()).indexOf("Web L"))
            return true;
        else
            return false;
    }

    /**
     *  Finds the course code, number, and section.
     *  @param row  Row from the class schedule table.
     *  @return Array of strings of length 3.
     */
    function generateCourseInfoArray(row)
    {
        var columns = $(row).find("td");
        // Find the first instance of the ":"
        var courseText = $.trim($(columns).eq(COURSE_TITLE).text());
        var courseInfoStr = courseText.substring(0, courseText.indexOf(":")).replace(/-/g,"_");

        if (courseInfoStr.indexOf("_") >= 0)
            return courseInfoStr.split("_");
        else
          	return [];
    }

    /**
     *  Finds the student's ID in Student Planner.
     *  @return ID Number as a formatted string.
     */
    function parseId()
    {
        var str = $($("#user-profile-details").find("p")[1]).text();
        return $.trim(str.substring(str.indexOf(":") + 1));
    }

    /**
     *  Returns an array containing both the lecture times and the lab times.
     *  @param row  Row from the class schedule table.
     *  @return Array of strings of length 2.
     */
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

            if ((meetTime.indexOf("/") < 0) && (meetTime !== ""))
                result.push(meetTime);
        });

        if (result.length === 1)
            result.push("");
        return result;
    }

    /**
     *  Decides which term to use for Colleage and the table's terms.
     *  @return String such as 20/SP
     */
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

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                                      Colleague Functions                                 //
    //          All functions here should apply to Colleague (exclusively, if possible)         //
    //  Most of the code here is "existence-based", in that it will only execute if the given   //
    //                                     elements exist.                                      //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    function colleagueFix()
    {
      	if ($("#btn_close_report_browser").length)
        {
          	$("#btn_close_report_browser").on("click", function () {
                cleanUp();
                scheduleResult = {};
            });
        }

        if (isDataAvailable())
        {
            // Exclusive to registration forms
            if ($("#popup-lookup").length)
            {
                var edited = $("#popup-lookup").attr("edited");
                if (typeof edited === "undefined")
                {
                    $("#popup-lookup").attr("edited", "true");
                    $("#popup-lookup").val(scheduleResult.studentId);

                    // Due to the text insertion bug, we inform the user what to do to validate the text.
                    insertTooltip("Press Right Arrow, Space, then Enter.");
                }
            }

            // Exclusive to registration forms
            if ($("#JS-VAR1").length)
            {
                var edited = $("#JS-VAR1").attr("edited");
                if (typeof edited === "undefined")
                {
                    $("#JS-VAR1").attr("edited", "true");
                    $("#JS-VAR1").val(scheduleResult.semester);
                }
            }

            if ($("#report-browser-pre-text").length)
            {
              	if ($("#report-browser-pre-text").val().indexOf(PRETEXT_BREAKER) >= 0)
                {
                    // Set a flag on the pretext window that allows us to communicate
                    // with the Quickprint script to not execute its part, and instead
                    // use the code here for the "adjusted" Quickprint
                    $("#report-browser-pre-text").attr("regform", "1");
                }

                // Adjust the functionality of the big Download button in accordance with the new Quickprint functionality
                if ($("#fileDownloadBtn").length)
                {
                    var url = $("#fileDownloadBtn").attr("href");

                    // Only make a new button if we're in the 'Save As' dialog.
                    if (!hasFileExt(url))
                    {
                        var adjustedBtn = $cloneBtn($("#fileDownloadBtn"))
                                                    .attr("id", "quickprint")
                                                    .attr("href", null)
                        $(adjustedBtn).text("Quickprint");
                        $("#fileDownloadBtn").replaceWith(adjustedBtn);

                        adjustedBtn.on("click", function () {
                            quickprintAdjusted(url);
                        });

                        // PRINT IMMEDIATELY!!! The button solely exists as a failsafe.
                        quickprintAdjusted(url);
                    }
                }
            }
        }
    }

    /**
     *  Heart of the logic for printing data from the Colleague server. Does so by
     *  downloading data via a given URL and putting it into an iframe and calling
     *  the browser's print() function.
     *  @param fileUrl  A URL provided as a string.
     */
    function quickprintAdjusted(fileUrl)
    {
        // In case there's residual data from last time, clean things up...
        cleanUp();

        // Make the iframe...
        $("<iframe>", {
            id:  "dataWindow",
            frameborder: 0
        }).appendTo("body");
        var iframe = $("#dataWindow");

        // Get the data...
        $.get(fileUrl, function(data)
        {
            // Put the data into the iframe. Thankfully, <pre> is available for displaying fixed-width text data.
            $("<pre>", {
                id:  "textData",
                style: "border: none",
            }).appendTo($(iframe).contents().find("body"));
            formatRegForm(iframe, data);

        }, 'text').done(function() {
            $(iframe).ready(function() {
                $(iframe).get(0).contentWindow.print();
            });
        }).fail(function() {
            alert("ERROR: Colleague failed to provide data to us. Please log out and try again.");
        });
    }

    /**
     *  Creates a table object for Colleague via the information provided from Student Planner.
     *  @return Formatted table.
     */
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

        const STYLE_TABLE = {"border-style":"dashed",
                             "border-width":"thin",
                             "font-family":"monospace",
                             "font-size":"120%"}
        $(table).find("td, th").css(STYLE_TABLE);
        return table;
    }

    /**
     *  Inserts the table of classes appropriately into the regform sheet.
     *  @param iframe   The iframe window loaded into the webpage.
     *  @param data     Text data from Colleague.
     */
    function formatRegForm(iframe, data)
    {
        // If there are any typos we wish to fix, we fix them here.
        if (FIX_TYPOS_ENABLED)  data = fixTypos(data);

        // Idiot-proofing: prepare the data for regform table insertion if necessary.
        if (data.indexOf(PRETEXT_BREAKER) >= 0)
        {
            var preText = data.substring(0, data.indexOf(PRETEXT_BREAKER));
            var postText = data.substring(data.lastIndexOf(POSTTEXT_BREAKER) + POSTTEXT_BREAKER.length + 1);

            $(iframe).contents().find("#textData").text(preText);
            $(createRegTable()).appendTo($(iframe).contents().find("body"));

            // Put the data into the iframe.
            $("<pre>", {
                id:  "textDataPost",
                style: "border: none",
            }).appendTo($(iframe).contents().find("body"));

            $(iframe).contents().find("#textDataPost").text(postText);
        }
        // Otherwise, just put the data into the iframe
        else
        {
            $(iframe).contents().find("#textData").text(data);
        }
    }

    /**
     *  Inserts a tooltip in the modal popup window.
     *  @param msg  The message to display to the user.
     */
    function insertTooltip(msg)
    {
        const STYLE_TOOLTIP = {"font-weight":"bold",
                                "color":"DarkSlateBlue"};
        $("<p>", {
            id:  "regform-tooltip"
        }).css(STYLE_TOOLTIP)
        .appendTo("#modalMessageContainer")
        .text(msg);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                                  Utility Functions                                       //
    //            Small code snippets that are vital, but hidden to prevent confusion           //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////

    /* Clones the given button */
    function $cloneBtn($btn)
    {
        var $adjustedBtn = $btn.clone()
                                .off()
                                .attr("href", null)
                                .removeAttr("data-bind");   // Student Planner places the click event in data-bind
        return $adjustedBtn;
    }

    /**
     *  Fixes any annoying typos in the regform data.
     *  @param data Text data.
     *  @return Corrected data.
     */
    function fixTypos(data)
    {
        // We pair the words such that the misspelling is on the left, and the correct spelling is on the right.
        var wordPairs = ["Menengitis",  "Meningitis",
                         "adivce",      "advice"];
        // Replace each instance of a misspelled word with the correct spelling in the data
        for (var i = 1; i < wordPairs.length; i += 2) {
            data = data.replace(wordPairs[i - 1], wordPairs[i]);
        }
        return data;
    }

    /**
     *  Decides which 8-week term the class is in, based on its section code.
     *  @param  section The class's section code.
     *  @return         String
     */
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
                if (section.indexOf("WK") >= 0)
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

    /**
     *  Determines if data was sent over from Colleague AND it hasn't been expended.
     *  @return boolean
     */
    function isDataAvailable()
    {
        return !($.isEmptyObject(scheduleResult));
    }

    /**
     *  Decides whether or not the url has a file extension
     *  @param  url A URL provided as a string.
     *  @return     boolean
     */
    function hasFileExt(url)
    {
        var filename = url.substring(url.lastIndexOf('/') + 1, url.lastIndexOf('?'));
        return filename.lastIndexOf('.') >= 0;
    }

    /**
     *  Removes the hidden iframe window we may create.
     */
    function cleanUp()
    {
        if ($("#dataWindow").length)
            $("#dataWindow").remove();
    }

    /* Begin document observation */
    observer.observe(document,	{
        childList: true,
        subtree: true
    });
}());
