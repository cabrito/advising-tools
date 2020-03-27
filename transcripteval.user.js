// ==UserScript==
// @name                Transcript Eval
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out the Transcript Evaluation Form
// @version             3.0
// @include             https://*.edu*/Student/Planning/Advisors/Advise/*
// @include             https://*.edu*/current-students/records/transcripts/request-evaluation-of-another-colleges-transcript/*
// @include             https://*.edu*/UI/home/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM.getValue
// @grant               GM.setValue
// @grant               GM.deleteValue
// ==/UserScript==

// Set as you like: (true = enabled, false = disabled)
const MOVE_TO_NOTES_TAB_ENABLED = true;

// In the event that the URL for the transcript eval form/Student Planner changes, you will need to update this with the correct URLs.
// MAKE SURE THE LINK GOES IN BETWEEN THE QUOTES!!!
const URL_REPLACE_FORM  = "PUT-THE-LINK-TO-THE-TRANSCRIPT-EVALUATION-FORM-HERE-IN-BETWEEN-THESE-QUOTES";
const URL_FRAG_SP       = "/Student/Planning/Advisors/Advise/";     // You just need a piece of the URL
const URL_COLLEAGUE     = "https://chelsea.odessa.edu/UI/home/index.html";

// *DON'T* TOUCH
const URL_CURRENT = window.location.href;

// Information regarding the MutationObserver for Colleague
var MutationObserver    = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
var observer            = new MutationObserver(colleagueFix);
var obsConfig           = {childList: true,
                            subtree: true};

class Button {
    constructor($source, id, text) {
        this.$btn = $source.clone()
                        .off()
                        .prop("href", null)
                        .prop("id", id)
                        .removeProp("data-bind");   // Student Planner places the click event in data-bind
        this.$btn.html(text);
    }

    // Methods
    get() {
        return this.$btn;
    }

    setText(str) {
        this.$btn.html(str);
        return this;
    }

    setPrimary() {
        this.$btn.prop("class", "eds-button eds-button--primary");
        return this;
    }

    floatRight() {
        this.$btn.css({"float":"right"});
        return this;
    }
}

// Student Object definition
class Student {
    // Primary Constructor
    constructor(id, major) {
        this.id     = id;
        this.major  = major;
        this.first  = "";
        this.middle = "";
        this.last   = "";
        this.email  = "";
        this.ssn    = "";
        this.tel    = "";
        this.dob    = "";
    }
}

/**
 *  The "main" function of the code.
 */
(async function() {
    "use strict";

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                              Student Planner Functions                                   //
    //  All functions here should apply to Student Planner scraping (exclusively, if possible)  //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    if (URL_CURRENT.includes(URL_FRAG_SP)) {
        if ($("#program-list").length) {
            if ($("#trans-eval-btn").length === 0) {
                var transEvalBtn = new Button($("#whatif"), "trans-eval-btn", "Transcript Evaluation");
                transEvalBtn
                    .setPrimary()
                //  .floatRight()
                    .get().insertBefore("#unofficial-transcripts");

                // Set the button functionality
                transEvalBtn.get().on("click", function () {
                    // Reset the data just in case
                    //GM.deleteValue("trans-eval-bundle");

                    // Now, start assembling all the data that we need
                    var studentIdText = $.trim($(".esg-person-card__detail").eq(1).text());
                    var studentId = studentIdText.substring(studentIdText.lastIndexOf(" ") + 1);
                    var majorText = getCurrentMajor();
                    var major = majorText.substring(0, majorText.lastIndexOf("(") - 1);
                    var student = new Student(studentId, major);

                    // Send the data over to Colleague
                    var $colleagueAnchor = $("<a>", {
                        href: URL_COLLEAGUE,
                        target: "_blank",
                        text: "(Click here to go to Colleague)",
                        click: MOVE_TO_NOTES_TAB_ENABLED ? moveToNotesTab : null
                    });
                    GM.setValue("trans-eval-bundle", JSON.stringify(student));
                    insertTooltip("Data bundle sent to Colleague. " +
                                    "Use NAE to access. ", this)
                                    .append($colleagueAnchor);
                });
            }
        }
    }
    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                              Transcript Eval Form Functions                              //
    //    All functions here should apply to the major change form (exclusively, if possible)   //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    else if (URL_CURRENT.includes(URL_REPLACE_FORM)) {
        let student = JSON.parse(await GM.getValue("trans-eval-bundle", JSON.stringify(new Student(0,""))));
        GM.deleteValue("trans-eval-bundle");

        // Cancel filling the form if blank data was sent over.
        if (student.id <= 0)    return;

        // Now, fill out the form
        $("input[name='studentID']").val(student.id);
        $("input[name='Last Name']").val(student.last);
        $("input[name='First Name']").val(student.first);
        $("input[name='Middle Name']").val(student.middle);
        $("input[name='email']").val(student.email);
        $("input[name='Social Security #']").val(student.ssn);
        $("input[name='Phone']").val(student.tel);
        $("input[name='DOB']").val(student.dob);
        $("input[name='Major']").val(student.major);


        // Show the user they need to fill out the section to state which colleges to evaluate the transcript for
        var fieldsetList = $("fieldset");
        for (var i = 0; i < fieldsetList.length; i++) {
            var inputList = fieldsetList.eq(i).find("input[type='text']");
            for (var j = 0; j < inputList.length; j++) {
                if (inputList.eq(j).val() === "") {
                    highlightGroup(fieldsetList.eq(i));
                    break;
                }
            }
        }

        var isDegree = !student.major.includes("Cert");

        // We need to also determine if the new major is a certificate or not
        if (isDegree)
        {
            if(student.major.toUpperCase().includes("AAS")) {
                $("input[type='radio'][value='Associate of Applied Science']").prop("checked", true);
            } else if (student.major.toUpperCase().includes("AS")) {
                $("input[type='radio'][value='Associate of Science']").prop("checked", true);
            } else {
                $("input[type='radio'][value='Associate of Arts']").prop("checked", true);
            }
        }
        else
        {
            // If it's a certificate, which level is it?
            var certificateLevel = parseInt($.trim(student.major).slice(-1), 10);

            if (certificateLevel === 2)
                $("input[type='radio'][value='Level 2 Certificate']").prop("checked", true);
            else
                $("input[type='radio'][value='Level 1 Certificate']").prop("checked", true);
        }
        GM.deleteValue("trans-eval-bundle");
    }
    else {
        observer.observe(document, obsConfig);
    }

}());

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
    return !nonmajorList.includes(text);
}

function highlightGroup($group) {
    $group.css("background-color", "pink");
}

//////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                          //
//                                      Colleague Functions                                 //
//          All functions here should apply to Colleague (exclusively, if possible)         //
//  Most of the code here is "existence-based", in that it will only execute if the given   //
//                                     elements exist.                                      //
//                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////

async function colleagueFix() {
    let student = JSON.parse(await GM.getValue("trans-eval-bundle", JSON.stringify(new Student(0,""))));

    if ($(".formActive").eq(0).text().includes("NAE")) {
        // Fill out the ID Number lookup if we have data to do so
        if ($("#popup-lookup").val().length === 0) {
            if (student.id > 0) {
                $("#popup-lookup").val(student.id);
                insertTooltip("Press Right Arrow, Space, then Enter.", $("#modalMessageContainer"));
            }
        }

        // Add the handy Evaluate button to Colleague with all of its data-harvesting glory
        if ($("#grabDataBtn").length === 0) {
            var grabDataBtn = new Button($("#btnNavigate"), "grabDataBtn", "Evaluation");
            grabDataBtn.$btn
                        .on("click", function () {
                            try {
                                student.first   = $("#FIRST-NAME").val();
                                student.last    = $("#LAST-NAME").val();
                                student.middle  = $("#MIDDLE-NAME").val();
                                student.email   = $("#PERSON-EMAIL-ADDRESSES_1").val();
                                student.tel     = $("#VAR-PHONES_1").val().replace(/-/g, "");
                                student.ssn     = $("#SSN").val().substring($("#SSN").val().lastIndexOf("-") + 1);
                                student.dob     = $("#BIRTH-DATE").val();

                                // If we didn't go through Student Planner first
                                if (student.id === 0)
                                    student.id  = $("#VAR1").val();
                            } catch (error) {
                                console.error(error);
                            }

                            GM.setValue("trans-eval-bundle", JSON.stringify(student));

                            $("#btnFormCancelAll").click();
                            window.open(URL_REPLACE_FORM, "_blank");
                            $(this).remove();
                        })
                        .css({"background-color":"red"})
                        .insertAfter("#btnNavigate");
        }
    } else {
        $("#grabDataBtn").remove();
    }
}

/**
 *  Inserts a tooltip after the selected element
 *  @param msg  The message to display to the user.
 *  @return jQuery object for chaining
 */
function insertTooltip(msg, selector)
{
    if ($("#tooltip").length)   $("#tooltip").remove();
    const STYLE_TOOLTIP = {"font-weight":"bold",
                            "color":"DarkSlateBlue"};
    return $("<p>", {
        id:  "tooltip"
    }).css(STYLE_TOOLTIP)
    .insertAfter($(selector))
    .text(msg);
}

function moveToNotesTab() {
    $("#notes-tab").find("a")[0].click();
    $("#advising-notes-compose-box").attr("placeholder", "PASTE RESULTS HERE.");
}
