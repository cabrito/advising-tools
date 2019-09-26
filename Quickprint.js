// ==UserScript==
// @name                Colleague Quickprint
// @author              cabrito
// @namespace           https://github.com/cabrito
// @description         Removes the requirement of Colleague UI to go through Adobe Reader to print.
// @version             1.8
// @include             https://*.edu*/UI/home/*
// @require             https://code.jquery.com/jquery-3.4.1.min.js
// @grant               GM_info
// @grant               GM.getValue
// @grant               GM.setValue
// ==/UserScript==

(function() {
    "use strict";

    /**
     *  The core of the logic to make appropriate changes to the document.
     */
    var observer = new MutationObserver(function (mutations, mi) {
      	quickprintLogic();
    });

    function quickprintLogic()
    {
        // If the Print Remote button exists, remove it and adjust the Save As dialog to say Quick Print.
        if ($("#reportPrint").length)
        {
            $("#reportPrint").remove();
            $("#reportSaveAs").text("Quickprint");
        }

        // Create new functionality for the big Download button.
        if ($("#fileDownloadBtn").length)
        {
            // Exists solely to communicate with the Autoregform.js script.
            // Intended to prevent this script from executing if the regform data
            // was sent over from Student Planner.
            var regformDataAvailable = $("#report-browser-pre-text").attr("regform");
            if (typeof regformDataAvailable === "undefined")
            {
                var url = $("#fileDownloadBtn").attr("href");

                // Only make a new button if we're in the 'Save As' dialog.
                if (!isPdf(url))
                {
                    var adjustedBtn = $("#fileDownloadBtn").clone()
                                                .attr("id", "quickprint")
                                                .attr("href", null)
                                                .attr("class", "esg-button-style esg-button esg-button--primary")
                                                .attr("type", "button");
                    $(adjustedBtn).text("Quickprint");
                    $("#fileDownloadBtn").replaceWith(adjustedBtn);
                    adjustedBtn.on("click", function () { quickPrint(url); });

                    // PRINT IMMEDIATELY!!! The button solely exists as a failsafe.
                    quickPrint(url);
                }
            }
        }

        // Remove the data window(s) when we're done.
        if ($("#fileCloseBtn").length)
        {
            $("#fileCloseBtn").on("click", function ()
                                            {
                                                if ($("#dataWindow").length)
                                                {
                                                    $("#dataWindow").remove();
                                                }
                                            });
        }

      	if ($("#btn_close_report_browser").length)
        {
          	$("#btn_close_report_browser").on("click", function ()
                                            {
                                                if ($("#dataWindow").length)
                                                {
                                                    $("#dataWindow").remove();
                                                }
                                            });
        }
    }

    /**
     *  Heart of the logic for printing data from the Colleague server. Does so by
     *  downloading data via a given URL and putting it into an iframe and calling
     *  the browser's print() function.
     *  @param fileUrl  A URL provided as a string.
     */
    function quickPrint(fileUrl)
    {
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

            $(iframe).contents().find("#textData").text(formatData(data));
        }, 'text').done(function() {
            $(iframe).ready(function() {
                $(iframe).get(0).contentWindow.print();
            });
        }).fail(function() {
            alert("ERROR: Colleague refused to provide data to us. Please log out and try again.");
        });;
    }

    /**
     *  Decides whether the API URL refers to a PDF or not.
     *  @param  url A URL provided as a string.
     *  @return     boolean
     */
    function isPdf(url)
    {
        var extension = url.substring(url.lastIndexOf('.') + 1, url.lastIndexOf('?') );
        return (extension === "pdf");
    }

    /**
     *	Fixes the problem encountered when the AUX code prints at the top of RGN statements.
     *	@param	data	Text data provided from Colleague
     *	@return				Either the same input text, or all the text after the first pagebreak.
     */
    function formatData(data)
    {
      	// Uses regexp to remove all whitespace characters globally in the data.
        var newStr = data.replace(/\s/g, '');

      	// In RGN statements, the first non-whitespace character is "#". We skip everything until the first pagebreak \f
        if (newStr.charAt(0) !== "#")
        {
            return data;
        } else {
            return data.substring(data.indexOf("\f"));
        }
    }

    /* Begin document observation */
    observer.observe(document,	{
                                    childList: true,
                                    subtree: true
    							}
    );

}());
