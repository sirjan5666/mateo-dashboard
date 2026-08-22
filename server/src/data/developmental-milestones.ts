/**
 * Developmental milestones across 10 domains, covering ages 0–60 months (0–5 years).
 *
 * Sources: WHO motor milestones (Acta Paediatrica, 2006), AAP/CDC developmental
 * monitoring guidelines, IAP developmental assessment recommendations.
 *
 * STATUS: REQUIRES PEDIATRICIAN SIGN-OFF BEFORE LAUNCH.
 *
 * Every baby develops at their own pace — these are typical ranges, NOT a test or a
 * diagnosis. Only flag (gently) when a window is fully exceeded.
 */

export type DevDomain =
  | 'gross_motor'
  | 'fine_motor'
  | 'cognitive'
  | 'language'
  | 'social_emotional'
  | 'vision'
  | 'hearing'
  | 'physical_growth'
  | 'sensory_processing'
  | 'adaptive';

export interface DevMilestone {
  id: string;
  domain: DevDomain;
  name: string;
  description: string;
  ageRangeMonths: { min: number; max: number };
  redFlags?: string[];
}

export const DEV_DOMAINS: Record<DevDomain, { label: string; emoji: string; description: string }> = {
  gross_motor: { label: 'Gross Motor', emoji: '🏃', description: 'Large body movements — head control, sitting, walking, running' },
  fine_motor: { label: 'Fine Motor', emoji: '✋', description: 'Small precise movements — grasping, drawing, cutting' },
  cognitive: { label: 'Cognitive', emoji: '🧠', description: 'Thinking, learning, problem solving, memory' },
  language: { label: 'Language', emoji: '💬', description: 'Communication — sounds, words, sentences, understanding' },
  social_emotional: { label: 'Social & Emotional', emoji: '🤝', description: 'Relationships, feelings, social interaction' },
  vision: { label: 'Vision', emoji: '👁️', description: 'Visual tracking, recognition, depth perception' },
  hearing: { label: 'Hearing', emoji: '👂', description: 'Sound response, localization, following instructions' },
  physical_growth: { label: 'Physical Growth', emoji: '📏', description: 'Weight, length/height, head circumference — tracked on the Growth page' },
  sensory_processing: { label: 'Sensory Processing', emoji: '🖐️', description: 'Responding to touch, textures, sensory input' },
  adaptive: { label: 'Self-Help Skills', emoji: '🥄', description: 'Self-feeding, drinking, dressing, toileting readiness' },
};

export const developmentalMilestones: DevMilestone[] = [
  // ────────────────────────────────────────────────────────────────────
  // GROSS MOTOR
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'gross_motor_head_control',
    domain: 'gross_motor',
    name: 'Head control',
    description: 'Holds head steady when held upright or in tummy-time position',
    ageRangeMonths: { min: 1, max: 4 },
    redFlags: ['No head control by 4 months', 'Head consistently tilts to one side'],
  },
  {
    id: 'gross_motor_rolls_over',
    domain: 'gross_motor',
    name: 'Rolls over',
    description: 'Rolls from tummy to back and back to tummy',
    ageRangeMonths: { min: 3, max: 7 },
    redFlags: ['Cannot roll in either direction by 7 months'],
  },
  {
    id: 'gross_motor_sits_supported',
    domain: 'gross_motor',
    name: 'Sits with support',
    description: 'Sits upright with hands propping or adult support',
    ageRangeMonths: { min: 4, max: 6 },
  },
  {
    id: 'gross_motor_sits_unsupported',
    domain: 'gross_motor',
    name: 'Sits without support',
    description: 'Sits steadily without using hands to prop up',
    ageRangeMonths: { min: 5, max: 9 },
    redFlags: ['Cannot sit unsupported by 9 months'],
  },
  {
    id: 'gross_motor_crawling',
    domain: 'gross_motor',
    name: 'Crawling',
    description: 'Moves forward on hands and knees (some babies scoot or skip this stage)',
    ageRangeMonths: { min: 6, max: 12 },
  },
  {
    id: 'gross_motor_pulls_to_stand',
    domain: 'gross_motor',
    name: 'Pulls to stand',
    description: 'Uses furniture or support to pull themselves to standing',
    ageRangeMonths: { min: 7, max: 12 },
    redFlags: ['Cannot pull to stand by 12 months'],
  },
  {
    id: 'gross_motor_walks_supported',
    domain: 'gross_motor',
    name: 'Walks with support',
    description: 'Takes steps while holding onto furniture or hands (cruising)',
    ageRangeMonths: { min: 8, max: 13 },
  },
  {
    id: 'gross_motor_stands_alone',
    domain: 'gross_motor',
    name: 'Stands alone',
    description: 'Stands without holding on, even briefly',
    ageRangeMonths: { min: 9, max: 16 },
  },
  {
    id: 'gross_motor_walks_alone',
    domain: 'gross_motor',
    name: 'Walks independently',
    description: 'Takes several steps independently without support',
    ageRangeMonths: { min: 9, max: 18 },
    redFlags: ['Not walking by 18 months'],
  },
  {
    id: 'gross_motor_runs',
    domain: 'gross_motor',
    name: 'Running',
    description: 'Runs with coordination, can stop and change direction',
    ageRangeMonths: { min: 15, max: 24 },
  },
  {
    id: 'gross_motor_kicks_ball',
    domain: 'gross_motor',
    name: 'Kicks a ball',
    description: 'Kicks a ball forward without losing balance',
    ageRangeMonths: { min: 18, max: 30 },
  },
  {
    id: 'gross_motor_jumps_both_feet',
    domain: 'gross_motor',
    name: 'Jumps with both feet',
    description: 'Jumps off the ground with both feet leaving the floor together',
    ageRangeMonths: { min: 24, max: 36 },
  },
  {
    id: 'gross_motor_climbs_stairs_alternating',
    domain: 'gross_motor',
    name: 'Climbs stairs (alternating feet)',
    description: 'Goes up stairs using alternating feet without holding the railing',
    ageRangeMonths: { min: 30, max: 42 },
  },
  {
    id: 'gross_motor_hops_one_foot',
    domain: 'gross_motor',
    name: 'Hops on one foot',
    description: 'Hops on one foot several times without falling',
    ageRangeMonths: { min: 36, max: 48 },
  },
  {
    id: 'gross_motor_skipping',
    domain: 'gross_motor',
    name: 'Skipping',
    description: 'Skips with coordination using alternating feet',
    ageRangeMonths: { min: 48, max: 60 },
  },

  // ────────────────────────────────────────────────────────────────────
  // FINE MOTOR
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'fine_motor_grasping_reflex',
    domain: 'fine_motor',
    name: 'Palmar grasp',
    description: 'Grasps objects placed in hand (reflexive at first, then voluntary)',
    ageRangeMonths: { min: 0, max: 3 },
  },
  {
    id: 'fine_motor_reaches_objects',
    domain: 'fine_motor',
    name: 'Reaches for objects',
    description: 'Reaches out and bats at or grabs dangling objects',
    ageRangeMonths: { min: 3, max: 5 },
    redFlags: ['Does not reach for objects by 5 months'],
  },
  {
    id: 'fine_motor_transfers_hands',
    domain: 'fine_motor',
    name: 'Transfers between hands',
    description: 'Passes an object from one hand to the other',
    ageRangeMonths: { min: 5, max: 8 },
  },
  {
    id: 'fine_motor_raking_grasp',
    domain: 'fine_motor',
    name: 'Raking grasp',
    description: 'Uses whole hand to rake and pick up small items',
    ageRangeMonths: { min: 6, max: 9 },
  },
  {
    id: 'fine_motor_pincer_grip',
    domain: 'fine_motor',
    name: 'Pincer grip',
    description: 'Picks up small objects between thumb and index finger',
    ageRangeMonths: { min: 8, max: 12 },
    redFlags: ['No pincer grip by 12 months'],
  },
  {
    id: 'fine_motor_bangs_objects',
    domain: 'fine_motor',
    name: 'Bangs objects together',
    description: 'Holds an object in each hand and bangs them together',
    ageRangeMonths: { min: 7, max: 10 },
  },
  {
    id: 'fine_motor_stacking_2',
    domain: 'fine_motor',
    name: 'Stacks 2 blocks',
    description: 'Places one block on top of another to make a small tower',
    ageRangeMonths: { min: 12, max: 18 },
  },
  {
    id: 'fine_motor_scribbles',
    domain: 'fine_motor',
    name: 'Scribbles',
    description: 'Makes marks on paper with a crayon or pencil',
    ageRangeMonths: { min: 12, max: 18 },
  },
  {
    id: 'fine_motor_stacking_6',
    domain: 'fine_motor',
    name: 'Stacks 6+ blocks',
    description: 'Builds a tower of six or more blocks',
    ageRangeMonths: { min: 18, max: 24 },
  },
  {
    id: 'fine_motor_draws_line',
    domain: 'fine_motor',
    name: 'Draws a line',
    description: 'Copies a straight line (vertical or horizontal)',
    ageRangeMonths: { min: 24, max: 36 },
  },
  {
    id: 'fine_motor_draws_circle',
    domain: 'fine_motor',
    name: 'Draws a circle',
    description: 'Copies a circle or closed round shape',
    ageRangeMonths: { min: 30, max: 42 },
  },
  {
    id: 'fine_motor_uses_scissors',
    domain: 'fine_motor',
    name: 'Uses scissors',
    description: 'Cuts paper with child-safe scissors along a line',
    ageRangeMonths: { min: 36, max: 48 },
  },
  {
    id: 'fine_motor_draws_person',
    domain: 'fine_motor',
    name: 'Draws a person (3+ parts)',
    description: 'Draws a recognizable person with head, body, and limbs',
    ageRangeMonths: { min: 42, max: 60 },
  },

  // ────────────────────────────────────────────────────────────────────
  // COGNITIVE
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'cognitive_tracks_face',
    domain: 'cognitive',
    name: 'Tracks faces',
    description: 'Follows a face or bright object with their eyes across midline',
    ageRangeMonths: { min: 0, max: 3 },
    redFlags: ['Does not follow objects with eyes by 3 months'],
  },
  {
    id: 'cognitive_explores_hands',
    domain: 'cognitive',
    name: 'Explores own hands',
    description: 'Brings hands together and looks at them with curiosity',
    ageRangeMonths: { min: 2, max: 4 },
  },
  {
    id: 'cognitive_object_permanence',
    domain: 'cognitive',
    name: 'Object permanence',
    description: 'Looks for a toy that is hidden under a cloth',
    ageRangeMonths: { min: 6, max: 10 },
    redFlags: ['Shows no interest in finding hidden objects by 10 months'],
  },
  {
    id: 'cognitive_cause_effect',
    domain: 'cognitive',
    name: 'Cause and effect',
    description: 'Drops objects or pushes buttons repeatedly to see what happens',
    ageRangeMonths: { min: 6, max: 12 },
  },
  {
    id: 'cognitive_container_play',
    domain: 'cognitive',
    name: 'Container play',
    description: 'Puts objects into and takes them out of containers',
    ageRangeMonths: { min: 9, max: 14 },
  },
  {
    id: 'cognitive_simple_pretend',
    domain: 'cognitive',
    name: 'Simple pretend play',
    description: 'Pretends to feed a doll or talk on a phone',
    ageRangeMonths: { min: 12, max: 18 },
  },
  {
    id: 'cognitive_sorting_shapes',
    domain: 'cognitive',
    name: 'Sorts shapes',
    description: 'Matches shapes into a shape-sorter toy',
    ageRangeMonths: { min: 18, max: 24 },
  },
  {
    id: 'cognitive_matching_colours',
    domain: 'cognitive',
    name: 'Matches colours',
    description: 'Groups objects by colour or matches same-colour pairs',
    ageRangeMonths: { min: 24, max: 36 },
  },
  {
    id: 'cognitive_counts_to_5',
    domain: 'cognitive',
    name: 'Counts to 5',
    description: 'Counts up to 5 objects with one-to-one correspondence',
    ageRangeMonths: { min: 30, max: 42 },
  },
  {
    id: 'cognitive_understands_time',
    domain: 'cognitive',
    name: 'Understands time concepts',
    description: 'Understands today/tomorrow/yesterday and morning/night',
    ageRangeMonths: { min: 36, max: 48 },
  },
  {
    id: 'cognitive_problem_solving',
    domain: 'cognitive',
    name: 'Simple problem solving',
    description: 'Figures out simple puzzles (4-8 pieces) and how things work',
    ageRangeMonths: { min: 36, max: 48 },
  },
  {
    id: 'cognitive_counts_to_10',
    domain: 'cognitive',
    name: 'Counts to 10',
    description: 'Counts 10 objects correctly and recognizes some written numbers',
    ageRangeMonths: { min: 42, max: 60 },
  },

  // ────────────────────────────────────────────────────────────────────
  // LANGUAGE & COMMUNICATION
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'language_cooing',
    domain: 'language',
    name: 'Cooing',
    description: 'Makes soft vowel sounds (ooo, aaa) in response to voices',
    ageRangeMonths: { min: 1, max: 4 },
    redFlags: ['Makes no sounds at all by 4 months'],
  },
  {
    id: 'language_laughing',
    domain: 'language',
    name: 'Laughing',
    description: 'Laughs out loud when amused or tickled',
    ageRangeMonths: { min: 3, max: 5 },
  },
  {
    id: 'language_babbling',
    domain: 'language',
    name: 'Babbling',
    description: 'Strings consonant-vowel sounds together (ba-ba, da-da, ma-ma)',
    ageRangeMonths: { min: 5, max: 9 },
    redFlags: ['No babbling by 9 months', 'Does not respond to own name'],
  },
  {
    id: 'language_gestures',
    domain: 'language',
    name: 'Uses gestures',
    description: 'Points, waves bye-bye, or shakes head for no',
    ageRangeMonths: { min: 8, max: 12 },
    redFlags: ['No pointing or waving by 12 months'],
  },
  {
    id: 'language_first_words',
    domain: 'language',
    name: 'First words',
    description: 'Says 1–3 meaningful words (mama, dada, ball, etc.)',
    ageRangeMonths: { min: 10, max: 15 },
    redFlags: ['No words by 15 months'],
  },
  {
    id: 'language_10_words',
    domain: 'language',
    name: '10+ words',
    description: 'Uses at least 10 different words meaningfully',
    ageRangeMonths: { min: 15, max: 21 },
    redFlags: ['Fewer than 6 words by 18 months'],
  },
  {
    id: 'language_two_word_phrases',
    domain: 'language',
    name: 'Two-word phrases',
    description: 'Combines two words together (more milk, daddy go, big dog)',
    ageRangeMonths: { min: 18, max: 24 },
    redFlags: ['No two-word combinations by 24 months'],
  },
  {
    id: 'language_short_sentences',
    domain: 'language',
    name: 'Short sentences',
    description: 'Speaks in 3–4 word sentences and strangers understand most of it',
    ageRangeMonths: { min: 24, max: 36 },
    redFlags: ['Speech is mostly unintelligible to strangers by 36 months'],
  },
  {
    id: 'language_tells_stories',
    domain: 'language',
    name: 'Tells simple stories',
    description: 'Narrates simple events or stories in sequence',
    ageRangeMonths: { min: 36, max: 48 },
  },
  {
    id: 'language_complex_sentences',
    domain: 'language',
    name: 'Complex sentences',
    description: 'Uses because/but/and to make longer sentences, asks why/how questions',
    ageRangeMonths: { min: 42, max: 60 },
  },

  // ────────────────────────────────────────────────────────────────────
  // SOCIAL & EMOTIONAL
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'social_social_smile',
    domain: 'social_emotional',
    name: 'Social smile',
    description: 'Smiles back at a face on purpose (not just reflexive)',
    ageRangeMonths: { min: 1, max: 3 },
    redFlags: ['No social smile by 3 months'],
  },
  {
    id: 'social_recognizes_caregiver',
    domain: 'social_emotional',
    name: 'Recognizes caregiver',
    description: 'Shows clear preference for familiar faces, lights up when parent appears',
    ageRangeMonths: { min: 2, max: 5 },
  },
  {
    id: 'social_stranger_anxiety',
    domain: 'social_emotional',
    name: 'Stranger awareness',
    description: 'Shows wariness or distress around unfamiliar people (a normal stage)',
    ageRangeMonths: { min: 6, max: 10 },
  },
  {
    id: 'social_separation_anxiety',
    domain: 'social_emotional',
    name: 'Separation awareness',
    description: 'Protests or cries when primary caregiver leaves (a normal stage)',
    ageRangeMonths: { min: 7, max: 14 },
  },
  {
    id: 'social_parallel_play',
    domain: 'social_emotional',
    name: 'Parallel play',
    description: 'Plays beside other children, watching and imitating but not joining in',
    ageRangeMonths: { min: 18, max: 30 },
  },
  {
    id: 'social_shows_empathy',
    domain: 'social_emotional',
    name: 'Shows empathy',
    description: 'Notices when someone is upset and tries to comfort them',
    ageRangeMonths: { min: 18, max: 30 },
  },
  {
    id: 'social_takes_turns',
    domain: 'social_emotional',
    name: 'Takes turns',
    description: 'Takes turns in games or with toys (with adult prompting at first)',
    ageRangeMonths: { min: 24, max: 36 },
  },
  {
    id: 'social_cooperative_play',
    domain: 'social_emotional',
    name: 'Cooperative play',
    description: 'Plays WITH other children toward a shared goal or shared story',
    ageRangeMonths: { min: 36, max: 48 },
    redFlags: ['Shows no interest in other children by 36 months', 'Avoids eye contact consistently'],
  },
  {
    id: 'social_names_feelings',
    domain: 'social_emotional',
    name: 'Names feelings',
    description: 'Uses words like happy, sad, angry, scared to describe emotions',
    ageRangeMonths: { min: 30, max: 42 },
  },
  {
    id: 'social_follows_rules',
    domain: 'social_emotional',
    name: 'Follows group rules',
    description: 'Understands and follows basic rules in group settings',
    ageRangeMonths: { min: 42, max: 60 },
  },

  // ────────────────────────────────────────────────────────────────────
  // VISION
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'vision_focuses_face',
    domain: 'vision',
    name: 'Focuses on face',
    description: 'Focuses on a face 20–30 cm away',
    ageRangeMonths: { min: 0, max: 1 },
  },
  {
    id: 'vision_tracks_object',
    domain: 'vision',
    name: 'Tracks moving objects',
    description: 'Follows a slowly moving object across their field of vision',
    ageRangeMonths: { min: 1, max: 4 },
    redFlags: ['Does not follow objects with eyes by 4 months'],
  },
  {
    id: 'vision_reaches_seen',
    domain: 'vision',
    name: 'Reaches for what they see',
    description: 'Coordinates hand movements toward objects they can see',
    ageRangeMonths: { min: 3, max: 6 },
  },
  {
    id: 'vision_colour_recognition',
    domain: 'vision',
    name: 'Colour recognition',
    description: 'Names or points to at least 3–4 basic colours correctly',
    ageRangeMonths: { min: 24, max: 42 },
  },
  {
    id: 'vision_depth_perception',
    domain: 'vision',
    name: 'Depth perception',
    description: 'Judges distances well — navigates stairs, catches balls, avoids edges',
    ageRangeMonths: { min: 6, max: 12 },
  },
  {
    id: 'vision_recognizes_letters',
    domain: 'vision',
    name: 'Recognizes some letters',
    description: 'Identifies letters in their name and a few common letters',
    ageRangeMonths: { min: 36, max: 54 },
  },

  // ────────────────────────────────────────────────────────────────────
  // HEARING
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'hearing_startles_sound',
    domain: 'hearing',
    name: 'Startles to loud sounds',
    description: 'Blinks, startles, or cries in response to sudden loud noises',
    ageRangeMonths: { min: 0, max: 1 },
    redFlags: ['No startle response to loud sounds by 1 month'],
  },
  {
    id: 'hearing_responds_voice',
    domain: 'hearing',
    name: 'Responds to voice',
    description: 'Quietens or smiles when spoken to, shows interest in voices',
    ageRangeMonths: { min: 1, max: 3 },
    redFlags: ['Does not respond to any voice or sound by 3 months'],
  },
  {
    id: 'hearing_localizes_sound',
    domain: 'hearing',
    name: 'Localizes sound',
    description: 'Turns head toward the source of a sound',
    ageRangeMonths: { min: 3, max: 7 },
    redFlags: ['Does not turn toward sounds by 7 months'],
  },
  {
    id: 'hearing_responds_name',
    domain: 'hearing',
    name: 'Responds to name',
    description: 'Looks up or turns when their name is called',
    ageRangeMonths: { min: 5, max: 9 },
    redFlags: ['Does not respond to own name by 9 months'],
  },
  {
    id: 'hearing_simple_instructions',
    domain: 'hearing',
    name: 'Follows simple instructions',
    description: 'Follows one-step commands like "give me the ball" without gestures',
    ageRangeMonths: { min: 10, max: 16 },
    redFlags: ['Cannot follow simple verbal instructions by 16 months'],
  },
  {
    id: 'hearing_two_step_instructions',
    domain: 'hearing',
    name: 'Follows two-step instructions',
    description: 'Follows two-part directions like "pick up the toy and put it on the table"',
    ageRangeMonths: { min: 18, max: 30 },
  },

  // ────────────────────────────────────────────────────────────────────
  // SENSORY PROCESSING
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'sensory_responds_touch',
    domain: 'sensory_processing',
    name: 'Responds to touch',
    description: 'Calms with gentle touch or shows pleasure at being held',
    ageRangeMonths: { min: 0, max: 2 },
  },
  {
    id: 'sensory_mouths_objects',
    domain: 'sensory_processing',
    name: 'Mouths objects',
    description: 'Explores objects by bringing them to their mouth (a normal exploratory phase)',
    ageRangeMonths: { min: 3, max: 8 },
  },
  {
    id: 'sensory_texture_exploration',
    domain: 'sensory_processing',
    name: 'Texture exploration',
    description: 'Willingly touches different textures (smooth, rough, squishy, dry)',
    ageRangeMonths: { min: 6, max: 14 },
  },
  {
    id: 'sensory_messy_play',
    domain: 'sensory_processing',
    name: 'Messy play tolerance',
    description: 'Tolerates or enjoys sand, water, finger paint, or food on hands',
    ageRangeMonths: { min: 10, max: 20 },
    redFlags: ['Extreme distress with any messy textures beyond 20 months'],
  },
  {
    id: 'sensory_tolerates_grooming',
    domain: 'sensory_processing',
    name: 'Tolerates grooming',
    description: 'Accepts hair brushing, nail trimming, and teeth brushing without significant distress',
    ageRangeMonths: { min: 12, max: 24 },
  },
  {
    id: 'sensory_integration',
    domain: 'sensory_processing',
    name: 'Sensory integration',
    description: 'Manages daily sensory input (noise, crowds, clothing) without being overwhelmed',
    ageRangeMonths: { min: 24, max: 48 },
    redFlags: ['Consistently overwhelmed by everyday sensory input (covers ears in normal environments, refuses most clothing textures)'],
  },

  // ────────────────────────────────────────────────────────────────────
  // ADAPTIVE / SELF-HELP SKILLS
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'adaptive_finger_feeds',
    domain: 'adaptive',
    name: 'Self-feeding (fingers)',
    description: 'Picks up small food pieces and feeds themselves',
    ageRangeMonths: { min: 7, max: 12 },
  },
  {
    id: 'adaptive_drinks_cup',
    domain: 'adaptive',
    name: 'Drinks from a cup',
    description: 'Holds and drinks from an open cup with some spilling',
    ageRangeMonths: { min: 10, max: 16 },
  },
  {
    id: 'adaptive_uses_spoon',
    domain: 'adaptive',
    name: 'Uses a spoon',
    description: 'Scoops food with a spoon and brings it to mouth (some mess is normal)',
    ageRangeMonths: { min: 12, max: 18 },
  },
  {
    id: 'adaptive_removes_clothes',
    domain: 'adaptive',
    name: 'Removes simple clothing',
    description: 'Pulls off socks, shoes, or hat independently',
    ageRangeMonths: { min: 12, max: 20 },
  },
  {
    id: 'adaptive_helps_dressing',
    domain: 'adaptive',
    name: 'Helps with dressing',
    description: 'Pushes arms into sleeves or lifts feet for shoes when prompted',
    ageRangeMonths: { min: 15, max: 24 },
  },
  {
    id: 'adaptive_washes_hands',
    domain: 'adaptive',
    name: 'Washes hands',
    description: 'Washes and dries hands with prompting or minimal help',
    ageRangeMonths: { min: 18, max: 30 },
  },
  {
    id: 'adaptive_toileting_interest',
    domain: 'adaptive',
    name: 'Toileting awareness',
    description: 'Shows signs of readiness — tells you about wet/dirty diaper or hides to poop',
    ageRangeMonths: { min: 18, max: 30 },
  },
  {
    id: 'adaptive_toilet_trained_day',
    domain: 'adaptive',
    name: 'Daytime toilet trained',
    description: 'Uses the toilet or potty reliably during the day with few accidents',
    ageRangeMonths: { min: 24, max: 42 },
  },
  {
    id: 'adaptive_dresses_independently',
    domain: 'adaptive',
    name: 'Dresses independently',
    description: 'Puts on and takes off most clothing without help (may need help with buttons/zips)',
    ageRangeMonths: { min: 36, max: 54 },
  },
  {
    id: 'adaptive_brushes_teeth',
    domain: 'adaptive',
    name: 'Brushes teeth',
    description: 'Brushes teeth with minimal supervision (adult should still check)',
    ageRangeMonths: { min: 36, max: 54 },
  },
];

/**
 * Developmental concerns — early signs that warrant professional evaluation.
 * These are awareness items (NOT diagnoses). Presented with a "talk to your
 * pediatrician" CTA.
 */
export interface DevelopmentalConcern {
  id: string;
  category: 'speech' | 'motor' | 'social' | 'general';
  title: string;
  signs: string[];
  ageNote: string;
}

export const developmentalConcerns: DevelopmentalConcern[] = [
  {
    id: 'concern_speech_delay',
    category: 'speech',
    title: 'Speech & language delay indicators',
    signs: [
      'No babbling by 9 months',
      'No single words by 15 months',
      'No two-word phrases by 24 months',
      'Loss of previously acquired words at any age',
      'Not responding to name consistently by 12 months',
      'Speech mostly unintelligible to strangers by 3 years',
    ],
    ageNote: 'Language develops at varying rates, but these timelines are generally accepted as reasonable windows by pediatric speech professionals.',
  },
  {
    id: 'concern_motor_delay',
    category: 'motor',
    title: 'Motor delay indicators',
    signs: [
      'No head control by 4 months',
      'Not reaching for objects by 5 months',
      'Not sitting unsupported by 9 months',
      'Not pulling to stand by 12 months',
      'Not walking by 18 months',
      'Persistent hand preference before 12 months (may indicate weakness on one side)',
      'Very stiff or very floppy muscle tone',
    ],
    ageNote: 'Some variation is normal — many healthy babies crawl late or skip crawling entirely. The concern is a pattern of delays rather than one isolated skill.',
  },
  {
    id: 'concern_social_interaction',
    category: 'social',
    title: 'Social interaction concerns',
    signs: [
      'No social smile by 3 months',
      'No eye contact or avoids eye contact consistently',
      'Does not point or use gestures by 12 months',
      'No interest in other children by 30 months',
      'Does not engage in pretend play by 24 months',
      'Loss of social skills or words at any age (regression)',
    ],
    ageNote: 'These signs alone do not indicate any specific condition. Many children with one or two of these signs develop typically. A pattern of multiple signs across settings is what professionals look for.',
  },
  {
    id: 'concern_general',
    category: 'general',
    title: 'General developmental concerns',
    signs: [
      'Loss of any previously acquired skill at any age',
      'Significant difference between left and right side of body',
      'Extreme reactions to sensory input (light, sound, touch, textures)',
      'Persistent difficulty with transitions or changes in routine beyond age 3',
      'Not following simple instructions by 18 months',
    ],
    ageNote: 'These are general awareness items. If any concerns you, discussing with your pediatrician is always a good step — early support can make a meaningful difference.',
  },
];
