// ==UserScript==
// @name                Automajor
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out the Change Major form
// @version             1.5
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @include             https://*.edu/*advisor-major-change-request/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM.getValue
// @grant               GM.setValue
// ==/UserScript==

// For compatibility and security, we use an IIFE (Immediately invoked function expression)
(function() {
    "use strict";

    // You need to change this information before using!
    const ADVISOR_NAME              = "DO NOT PROCESS";
    const ADVISOR_EMAIL             = "TESTING. PLEASE IGNORE";
    const PASSWORD                  = "SSEM";
    const URL_MAJOR_CHANGE_FORM     = "https://www.odessa.edu/current-students/records/faculty/advisor-major-change-request/index.html";
    const URL_SPFRAG                = "/Student/Planning/Advisors/Advise/";
    const MOVE_TO_NOTES_TAB_ENABLED = true;

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                               Core Program Functionality                                 //
    //                      Herein lies what logic will execute and when                        //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    var observer = new MutationObserver(function (mutations, mi) {
        // For debugging purposes, I leave this try-catch block here to explain the errors that happen
        try {
            // If we're on Student Planner...
            if (window.location.href.indexOf(URL_SPFRAG) >= 0)
            {
                spFix();
            }
            // Otherwise, do stuff when we're on the Major Change request page.
            else if (window.location.href.indexOf(URL_MAJOR_CHANGE_FORM) >= 0)
            {
                majorChanger();
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

    // In certain instances such as when working with a Visiting Student, there is
    // no "Load Sample Course Plan" button permitted. We employ a failsafe for such
    // a situation by putting the "Change to this Major" button in a different spot.
    function spFix()
    {
        var $whatIfBtn = $("#whatif");
        var $progNotes = $("#get-evaluation-notices-link");

        // If we're on the "Progress" tab...
        if ($whatIfBtn.length)
        {
            // Create the "Change to this Major" button if it doesn't already exist.
            if ($("#change-major-button").length === 0)
            {
                // If the sample course plan button exists, replace it
                var $sampleCoursePlanBtn = $("#load-sample-plan-button");

                // First, by cloning it and changing its behavior accordingly.
                var $changeMajorBtn = $cloneBtn($whatIfBtn);
                $changeMajorBtn.html("Change to this Major")
                                .attr("id", "change-major-button");

                // Reprograms the "Change to this Major button" to take us to the major-change request form.
                $changeMajorBtn.on("click", function () {
                    GM.setValue("major-change-data", JSON.stringify(generateData()));
                    window.open(URL_MAJOR_CHANGE_FORM, "_blank");

                    // As a convenience, we swap to the Notes tab, because that's where we're likely to need to go next.
                    moveToNotesTab();
                });

                if ($sampleCoursePlanBtn.length)
                    $sampleCoursePlanBtn.replaceWith($changeMajorBtn);
                // Otherwise, stick it right next to the "Print" button
                else
                    $changeMajorBtn.insertAfter("#print-roster");
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

        // All information needed to change the student's major
        return {
            "studentName"  : studentName,
            "studentId"    : studentId,
            "currentMajor" : currentMajor,
            "newMajor"     : newMajor.substring(0, newMajor.lastIndexOf("(")),
            "newMajorCode": newMajor.substring(newMajor.lastIndexOf("(") + 1, newMajor.lastIndexOf(")"))
        };
    }

    /* Grabs the student's major in a context-aware manner. */
    function getCurrentMajor()
    {
      	var $programList = $(".esg-person-card__list-item");

      	// Scroll through the list and find the first non-UG or non-CE major
        for (var i = 1; i <= $programList.length - 1; i++)
        {
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
        return nonmajorList.indexOf(text) < 0;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                              Major-Change Form Functions                                 //
    //    All functions here should apply to the major change form (exclusively, if possible)   //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////

    /* Handles the logic required for changing the student's major on the webform. */
    function majorChanger()
    {
        GM.getValue("major-change-data", null).then(function (value) {
            if (value !== null)
            {
                var MAJOR_CHANGE_DATA = JSON.parse(value);
                GM.setValue("major-change-data", null);

                // Now, fill out the form
                $("[id='Advisor Name']").val(ADVISOR_NAME);
                $("[name='email']").val(ADVISOR_EMAIL);
                $("[id='Student Name']").val(MAJOR_CHANGE_DATA.studentName);
                $("[id='OC ID #']").val(MAJOR_CHANGE_DATA.studentId);
                $("[name='Current Major']").val(MAJOR_CHANGE_DATA.currentMajor);
                $("[id='New Major']").val(MAJOR_CHANGE_DATA.newMajor);
                $("[id='New Major Code']").val(MAJOR_CHANGE_DATA.newMajorCode);

                var isDegree = MAJOR_CHANGE_DATA.newMajor.indexOf("Cert") < 0;

                // We need to also determine if the new major is a certificate or not
                if (isDegree)
                {
                    $("input[type='radio'][value='Degree']").prop("checked", true);

                    // The ability to check the TSI status (or future equivalent)
                    // is not currently implemented. The only known way to find this
                    // information in Student Planner is via the "Show Program Notes"
                    // in the "Progress" tab. The hope is to implement this in the
                    // future.

                    // Find "TSI Passed?" section
                    var $controlGroups = $("div[class='control-group']");
                    for (var i = 0; i < $controlGroups.length; i++)
                    {
                        var $group = $controlGroups.eq(i);
                        if ($group.text().indexOf("TSI Passed?") >= 0)
                            $group.css("background-color", "pink");
                    }
                }
                else
                {
                    // If it is a certificate, what level is it?
                    var certificateLevel = parseInt($.trim(MAJOR_CHANGE_DATA.newMajor).slice(-1), 10);

                    if (certificateLevel === 1)
                    {
                        $("input[type='radio'][value='Certificate Level 1']").prop("checked", true);
                    }
                    else
                    {
                        $("input[type='radio'][value='Certificate Level 2']").prop("checked", true);
                    }

                    // Since certificates do not require TSI, go ahead and tick "N/A"
                    $("input[type='radio'][name='TSI Passed?'][value='N/A']").prop("checked", true);
                }

                // Lastly, insert the password
                $("[id='Password']").val(PASSWORD);
            }
        });
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                                  Utility Functions                                       //
    //            Small code snippets that are vital, but hidden to prevent confusion           //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////

    function moveToNotesTab()
    {
        if (MOVE_TO_NOTES_TAB_ENABLED)
        {
            $("#notes-tab").find("a")[0].click();
            $("#advising-notes-compose-box").attr("placeholder", "PASTE RESULTS HERE.");
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

    /* Begin document observation */
    observer.observe(document,  {
        childList: true,
        subtree: true
    });

}());
