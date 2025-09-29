DEFAULT_XML = """<sequence title="Generic Sequence Diagram Template">
  <participants>
    <!-- Participant 1: could be any system, service, or user -->
    <p id="participant1" label="Participant 1" highlight="true"/>
    
    <!-- Participant 2: could be another system or external component -->
    <p id="participant2" label="Participant 2"/>
    
    <!-- Participant 3: could be a database, application, or internal module -->
    <p id="participant3" label="Participant 3"/>
    
    <!-- Participant 4: could be an external partner, API, or additional service -->
    <p id="participant4" label="Participant 4"/>
  </participants>

  <messages>
    <!-- Step 1: Participant 1 sends a request to Participant 2 -->
    <m step="1" from="participant1" to="participant2" text="Initial request"/>

    <!-- Step 2: Participant 2 performs internal processing -->
    <m step="2" from="participant2" to="participant2" text="Internal processing"/>

    <!-- Step 3: Participant 3 responds to Participant 2 -->
    <m step="3" from="participant3" to="participant2" text="Return data"/>

    <!-- Step 4: Participant 2 returns response to Participant 1 -->
    <m step="4" from="participant2" to="participant1" text="Response delivered"/>

    <!-- Step 5: Participant 1 calls Participant 4 -->
    <m step="5" from="participant1" to="participant4" text="Send transaction"/>

    <!-- Step 6: Participant 4 notifies Participant 3 -->
    <m step="6" from="participant4" to="participant3" text="Forward information"/>

    <!-- Step 7: Participant 3 confirms to Participant 1 -->
    <m step="7" from="participant3" to="participant1" text="Final confirmation"/>
  </messages>
</sequence>
"""


def normalize_xml_for_html(xml_text: str) -> str:
    return xml_text
