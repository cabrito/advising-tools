// ==UserScript==
// @name                Grade Replacer
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Automatically fills out the Grade Replacement Form
// @version             4.0
// @include             https://*.edu/Student/Planning/Advisors/Advise/*
// @include             https://*.edu/current-students/records/forms/grade-replacement-gpa-update-request-for-repeat-coursework-online/*
// @exclude             https://*edu*.tld
// @require             https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @grant               GM.info
// @grant               GM.getValue
// @grant               GM.setValue
// @grant               GM.deleteValue
// ==/UserScript==

// *DON'T* TOUCH
const PREFERENCES = getPreferences();
const URL_FRAG_SP = "/Student/Planning/Advisors/Advise/";
const URL_CURRENT = window.location.href;
const COLORS_BUBBLE = ["wheat", "thistle", "lightsalmon", "pink", "lightgreen", "lightcyan"];

class Button {
    constructor($source, id, text) {
        this.$btn = $source.clone()
                        .off()
                        .prop("href", null)
                        .prop("id", id)
                        .removeAttr("data-bind", "null");   // Student Planner places the click event in data-bind
        this.$btn.val(text);
        this.$btn.html(text);
    }

    // Methods
    get() {
        return this.$btn;
    }

    setText(str) {
        this.$btn.val(str);
        this.$btn.html(str);
        return this;
    }

    setPrimary() {
        this.$btn.prop("class", "eds-button eds-button--primary");
        return this;
    }

    setSecondary() {
        this.$btn.attr("class", "eds-button eds-button--secondary");
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
    constructor(name, id, email) {
        var nameArr = name.split(" ");

        this.first  = nameArr[1];
        this.last   = nameArr[0].slice(0, -1);     // Slice to get rid of the comma
        this.middle = (nameArr.length < 3) ? "" : nameArr[2];
        this.id     = id;
        this.email  = email;
        this.bundle = [];
    }
}

function getPreferences()
{
    let prefs = localStorage.getItem("preferences");
    return JSON.parse(prefs) || {};
    // return JSON.parse(await GM.getValue("preferences", "{}"));
}

/**
 *  The "main" function of the code.
 */
(async function() {
    "use strict";

    var student = {};

    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                              Student Planner Functions                                   //
    //  All functions here should apply to Student Planner scraping (exclusively, if possible)  //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    if (URL_CURRENT.includes(URL_FRAG_SP)) {
        var $addTermBtn = $("input[type='button'][value='Add a Term']").prop("id", "add-term-btn");
        var gradeReplaceBtn = new Button($addTermBtn, "grade-replace-btn", "Start Grade Replacement");
        gradeReplaceBtn.floatRight()
                        .get().insertAfter($addTermBtn)
                        .on("click", function () {
                            initGradeReplace();
                            gradeReplaceBtn.setText("Finish Linking")
                                            .get().off()
                                            .on("click", function () {
                                                if ($.isEmptyObject(PREFERENCES)) {
                                                    alert("WARNING! Advisor preferences not set! Cannot continue.");
                                                    return;
                                                }
                                                if (!PREFERENCES.urls.gradeReplace.length) {
                                                    alert("WARNING! URL for grade replace form not set in preferences!");
                                                    return;
                                                }
                                                //$("#resetBtn").remove();
                                                GM.setValue("grade-replace-bundle", JSON.stringify(student));
                                                window.open(PREFERENCES.urls.gradeReplace, "_blank");
                                                if (PREFERENCES.personal.autoNotes)  moveToNotesTab();
                                            });
                            // Add reset Button
                            var resetBtn = new Button(gradeReplaceBtn.get(), "resetBtn", "Reset Linking");
                            resetBtn.setSecondary()
                                    .get().on("click", function () {
                                        resetLinking();
                                        initGradeReplace();
                                    })
                                    .insertAfter(gradeReplaceBtn.get());

                        });
    }
    //////////////////////////////////////////////////////////////////////////////////////////////
    //                                                                                          //
    //                            Grade Replacement Form Functions                              //
    //   All functions here should apply to the grade replace form (exclusively, if possible)   //
    //                                                                                          //
    //////////////////////////////////////////////////////////////////////////////////////////////
    else /*if (URL_CURRENT.includes(PREFERENCES.urls.gradeReplace))*/ {
        let student = JSON.parse(await GM.getValue("grade-replace-bundle", ""));
        GM.deleteValue("grade-replace-bundle");
        //console.log(JSON.stringify(student));

        // Cancel filling the form if blank data was sent over.
        if ($.isEmptyObject(student))    return;

        // Now, fill out the form
        $("input[name='Last Name']").val(student.last);
        $("input[name='First Name']").val(student.first);
        $("input[name='Middle Name']").val(student.middle);
        $("input[name='email']").val(student.email);
        $("input[name='Student ID #']").val(student.id);

        var $courseInputList    = $("input[name^='Course ']");
        var $lastAttemptList    = $("input[name^='last attempted ']");
        var $initialAttList     = $("input[name^='initial attempt ']");

        for (var i = 0; i < Math.floor(student.bundle.length / 2) * 2; i+=2) {
            var term1 = Object.values(student.bundle[i]).toString();
            var term2 = Object.values(student.bundle[i + 1]).toString();
            var n = parseInt(term1.substring(0, term1.indexOf('/')), 10);
            var m = parseInt(term2.substring(0, term2.indexOf('/')), 10);

            // In the event that the user accidentally put a past bubble before a future bubble, swap them.
            if (n === m) {
                const SEMESTER_INDEX = ["SP", "MM", "S1", "S2", "FA", "MW"];
                var tn = SEMESTER_INDEX.indexOf(term1.substring(term1.lastIndexOf('/') + 1));
                var tm = SEMESTER_INDEX.indexOf(term2.substring(term2.lastIndexOf('/') + 1));
                if (tn < tm)    [term1, term2] = [term2, term1];
            } else if (n < m) {
                [term1, term2] = [term2, term1];
            }

            // Then fill in the forms
            $courseInputList.eq(Math.floor(i/2)).val(Object.keys(student.bundle[i]));
            $lastAttemptList.eq(Math.floor(i/2)).val(term1);
            $initialAttList.eq(Math.floor(i/2)).val(term2);
        }
    }

    function initGradeReplace() {
        // First, get all the profile details...
        var name = $.trim($("#user-profile-name").text());
        var studentIdText = $.trim($(".esg-person-card__detail").eq(1).text());
        var studentId = studentIdText.substring(studentIdText.lastIndexOf(" ") + 1);
        var email = $.trim($(".user-profile-email").text());
        student = new Student(name, studentId, email);

        // Then, we need to add functionality for each timeline bubble
        var $bubbleList = $(".dp-coursebubble.dp-coursebubble-complete");
        $.each($bubbleList, function (i, bubble) {
            $(bubble).on("click", function () {
                const REPLACEMENT_LIMIT = 6;
                if (student.bundle.length < (REPLACEMENT_LIMIT * 2)) {
                    var $data = $(this).find("a");
                    var object = {};
                    object[$data.text()] = $data.prop("id").slice($data.prop("id").lastIndexOf('/') - 2, $data.prop("id").lastIndexOf('-'));
                    //object[$data.text()] = $data.prop("id");

                    // We cheat to prevent duplicates by checking if the bubble has a style attribute
                    if (!$(this).is("[style]")) {
                        $(this).css({"background-color": COLORS_BUBBLE[Math.floor(student.bundle.length / 2)]});
                        student.bundle.push(object);
                    }
                } else {
                    alert("You have tried to add too many course pairings.");
                }

            });
        })
    }

    function resetLinking() {
        // Then, we need to add functionality for each timeline bubble
        var $bubbleList = $(".dp-coursebubble.dp-coursebubble-complete");
        $.each($bubbleList, function (i, bubble) {
            if ($(bubble).is("[style]")) {
                $(bubble).off()
                        .removeAttr("style");
            }
        })
        student.bundle = [];
    }

}());

function highlightGroup($group) {
    $group.css("background-color", "pink");
}

function moveToNotesTab() {
    $("#notes-tab").find("a")[0].click();
    $("#advising-notes-compose-box").attr("placeholder", "PASTE RESULTS HERE.");
}
