// ==UserScript==
// @name                Advising Scripts Configuration
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Bundle of tools useful to make an academic advisor's life much easier in Colleague/Student Planning
// @version             0.1
// @include             https://*.edu/Student/UserProfile/Preferences
// @require             https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// ==/UserScript==

(function() {
    "use strict";

    // Set up the webpage
    generateForm();
    let PREFERENCES = getPreferences();
    fillForm(PREFERENCES);

    // Add button functionality
    $("#preferences").find("button").on("click", function () {
        try {
            setPreferences(generatePreferences());
        } catch (error) {
            console.error(error);
        }
    });

    $("#button-reset").on("click", resetPreferences);
}());

function generateForm()
{
    let prefHtml = `<!-- Personal information the user can set-->
    <div>
        <input id='button-reset' type='button' class='eds-button eds-button--secondary' value='Something broken? Click to Reset Preferences'>
    </div>
    <br>
    <section>
        <h2>Personal</h2>
        <div>
            <label for='username'>Name: </label>
            <input id='username' type='text' name='username' placeholder='John Doe'>
        </div>
        <div>
            <label for='email'>Email: </label>
            <input id='email' type='text' name='email' placeholder='jdoe@school.edu'>
        </div>
        <div>
            <label for='advpassword'>Advising Password: </label>
            <input id='advpassword' type='password' name='advpassword' size='33' placeholder='DO NOT PUT YOUR PERSONAL PASSWORD'>
        </div>
        <br>
        <div>
            <label for='option-notes-tab'>Move to Notes Tab Automatically? </label>
            <select id='option-notes-tab'>
                <option value='1'>Yes</option>
                <option value='0'>No</option>
            </select>
        </div>
    </section>

    <!-- Options to set the colors for Student Planning -->
    <section>
        <h2>Schedule Colors</h2>
        <!-- Primary Term -->
        <div>
            <table id='table-colors' align='center'>
                <thead align='center'>
                    <td></td>
                    <td>First</td>
                    <td>Second</td>
                    <td>Full</td>
                    <td>Banned</td>
                </thead>
                <tbody align='center'>
                    <tr>
                        <td>Term Color</td>
                        <td><input id='color-primary' type='color' name='color-primary' style='height:3rem;padding:0%' value='#ffdab9'></td>
                        <td><input id='color-secondary' type='color' name='color-secondary' style='height:3rem;padding:0%' value='#b0e0e6'></td>
                        <td><input id='color-full' type='color' name='color-full' style='height:3rem;padding:0%' value='#ffffff'></td>
                        <td><input id='color-banned' type='color' name='color-banned' style='height:3rem;padding:0%' value='#ff0000'></td>
                    </tr>
                    <tr>
                        <td>Text Color</td>
                        <td><input id='color-primary-text' type='color' style='height:3rem;padding:0%' name='color-primary-text'></td>
                        <td><input id='color-secondary-text' type='color' style='height:3rem;padding:0%' name='color-secondary-text'></td>
                        <td><input id='color-full-text' type='color' style='height:3rem;padding:0%' name='color-full-text'></td>
                        <td><input id='color-banned-text' type='color' style='height:3rem;padding:0%' name='color-banned-text' value='#ffffff'></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <br>
        <div>
            <label for='option-colors'>Use colors on schedule? </label>
            <select id='option-colors'>
                <option value='1'>Yes</option>
                <option value='0'>No</option>
            </select>
        </div>
    </section>

    <section>
        <h2>Advanced: URL Configuration</h2>
        <p>
            <em>Even if you aren't using a particular script, you will still need
                to set these. Note that if these are modified, you will need to
                change these at the top of each script as well.</em>
        </p>
        <p>
            <em>You MUST put the full URL here.</em>
        </p>
        <br>
        <div>
            <label for='url-colleague'>URL for Colleague: </label>
            <input id='url-colleague' type='text' name='url-colleague' size='50'>
        </div>
        <div>
            <label for='url-coursesub'>Course Substitution Form: </label>
            <input id='url-coursesub' type='text' name='url-coursesub' size='50'>
        </div>
        <div>
            <label for='url-gradereplace'>Grade Replacement Form: </label>
            <input id='url-gradereplace' type='text' name='url-gradereplace' size='50'>
        </div>
        <div>
            <label for='url-majorchange'>Major Change Form: </label>
            <input id='url-majorchange' type='text' name='url-majorchange' size='50'>
        </div>
        <!-- <div>
            <label for='url-transcripteval'>Transcript Evaluation Form: </label>
            <input id='url-transcripteval' type='text' name='url-transcripteval' size='50'>
        </div> -->
    </section>
    <section>
        <h2>Advanced: Term Filtering</h2>
        <p>
            The following list determines the section extensions to use when
            shading classes from search results/highlighting red on the schedule.
        </p>
        <p>
            Ensure that each extension is separated by a comma. Consult the Records office for a list of what each extension corresponds to.
        </p>
        <textarea id='filter-banned' name='name' rows='4' cols='80'>A,AC,AL,B,CH,CR,CT,D,E,EC,HS,I,J,K,L,M,MM,NT,P,R,RM,Q,RK,S,T,V,W</textarea>
    </section>`;
    $("#preferences > section").append(prefHtml);
}

function generatePreferences()
{
    let personal = {
        username:   $.trim($("#username").val()),
        email:      $.trim($("#email").val()),
        advPass:    $("#advpassword").val(),
        autoNotes:  parseInt($("#option-notes-tab").val(), 10)
    };
    let colors = {
        primary:        $("#color-primary").val(),
        primaryText:    $("#color-primary-text").val(),
        secondary:      $("#color-secondary").val(),
        secondaryText:  $("#color-secondary-text").val(),
        full:           $("#color-full").val(),
        fullText:       $("#color-full-text").val(),
        banned:         $("#color-banned").val(),
        bannedText:     $("#color-banned-text").val(),
        useColors:      parseInt($("#option-colors").val(), 10)
    };
    let urls = {
        colleague:      $.trim($("#url-colleague").val()),
        courseSub:      $.trim($("#url-coursesub").val()),
        gradeReplace:   $.trim($("#url-gradereplace").val()),
        majorChange:    $.trim($("#url-majorchange").val())//,
        //transcriptEval: $.trim($("#url-transcripteval").val())
    };
    let bannedExts = $("#filter-banned").val()
        .replace(/\s/g,'')
        .replace(/[^A-Za-z0-9\,]/g, '')
        .split(',')
        .filter(element => element);    // Prevent empty elements in the string

    return {
        personal:   personal,
        colors:     colors,
        urls:       urls,
        bannedExts: bannedExts
    };
}

function fillForm(PREFERENCES)
{
    // Don't continue if no preferences are detected.
    if ($.isEmptyObject(PREFERENCES))
        return;

    $("#username").val(PREFERENCES.personal.username);
    $("#email").val(PREFERENCES.personal.email);
    $("#advpassword").val(PREFERENCES.personal.advPass);
    $("#option-notes-tab").val(PREFERENCES.personal.autoNotes);

    $("#color-primary").val(PREFERENCES.colors.primary);
    $("#color-primary-text").val(PREFERENCES.colors.primaryText);
    $("#color-secondary").val(PREFERENCES.colors.secondary);
    $("#color-secondary-text").val(PREFERENCES.colors.secondaryText);
    $("#color-full").val(PREFERENCES.colors.full);
    $("#color-full-text").val(PREFERENCES.colors.fullText);
    $("#color-banned").val(PREFERENCES.colors.banned);
    $("#color-banned-text").val(PREFERENCES.colors.bannedText);
    $("#option-colors").val(PREFERENCES.colors.useColors);

    $("#url-colleague").val(PREFERENCES.urls.colleague);
    $("#url-coursesub").val(PREFERENCES.urls.courseSub);
    $("#url-gradereplace").val(PREFERENCES.urls.gradeReplace);
    $("#url-majorchange").val(PREFERENCES.urls.majorChange);
    //$("#url-transcripteval").val(PREFERENCES.urls.transcriptEval);

    $("#filter-banned").val(processBannedArray(PREFERENCES.bannedExts));
}

function setPreferences(prefs)
{
    try {
        localStorage.setItem("preferences", JSON.stringify(prefs));
    } catch (error) {
        alert("Error saving preferences: " + error);
    }
    // GM.setValue("preferences", JSON.stringify(prefs));
}

function getPreferences()
{
    let prefs = localStorage.getItem("preferences");
    return JSON.parse(prefs) || {};
    // return JSON.parse(await GM.getValue("preferences", "{}"));
}

function resetPreferences()
{
    localStorage.removeItem("preferences");
    location.reload();
    return false;
}

function processBannedArray(array) {
    //return JSON.stringify(array).replace(/[\[\]\"\']/g, '');
    return JSON.stringify(array).replace(/[^A-Za-z0-9\,]/g, '');
}
