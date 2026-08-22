/**
 * One person's account of the photo.
 *
 * Two rules from the MVP spec are enforced here rather than left to each screen:
 *
 *  1. Attribution is never optional. The name and the certainty are rendered as
 *     metadata above the words, so a reader cannot take in the claim without also
 *     taking in who made it and how sure they were.
 *  2. Excluding is not deleting. The owner's include toggle dims the card and says
 *     so in words — the remark is still here, it is just not going to the composer.
 *     Conflating the two would let an owner think they had removed someone's memory
 *     when they had only hidden it, or the reverse.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AttributionLine, CertaintyChip } from './labels';
import { Card, Row } from './layout';
import { IconButton } from './chrome';
import { Text } from './Text';
import { useTheme } from '../state/theme';
import { space } from '../theme/tokens';
import type { Remark } from '../../shared/story';

export function RemarkCard({
  remark,
  onToggleInclude,
  onDelete,
}: {
  remark: Remark;
  /** Omit both handlers to render read-only — the guest and story views do. */
  onToggleInclude?: (next: boolean) => void;
  onDelete?: () => void;
}) {
  const { c } = useTheme();
  const owned = Boolean(onToggleInclude || onDelete);
  const excluded = owned && !remark.included;

  const hints = [remark.dateHint, remark.locationHint].filter(Boolean) as string[];

  return (
    <Card style={excluded ? styles.excluded : undefined}>
      <View style={styles.body}>
        <Row style={styles.top}>
          <View style={styles.who}>
            <AttributionLine
              name={remark.contributorName}
              relationship={remark.relationship}
              at={remark.createdAt}
            />
          </View>
          {owned ? (
            <Row gap={0}>
              <IconButton
                name={remark.included ? 'check' : 'plus'}
                size={18}
                tone={remark.included ? 'default' : 'muted'}
                label={
                  remark.included
                    ? `Exclude ${remark.contributorName} from the story`
                    : `Include ${remark.contributorName} in the story`
                }
                onPress={() => onToggleInclude?.(!remark.included)}
              />
              <IconButton
                name="trash"
                size={18}
                tone="muted"
                label={`Delete the memory from ${remark.contributorName}`}
                onPress={() => onDelete?.()}
              />
            </Row>
          ) : null}
        </Row>

        {/* Serif: these are a person's words, not the archive's metadata. */}
        <Text variant="body">{remark.text}</Text>

        <Row style={styles.foot}>
          <CertaintyChip certainty={remark.certainty} />
          {hints.length ? (
            <Text variant="meta" tone="muted" style={styles.hints}>
              {hints.join(' · ')}
            </Text>
          ) : null}
        </Row>

        {excluded ? (
          <View style={[styles.notice, { borderTopColor: c.hairline }]}>
            <Text variant="meta" tone="muted">
              Not included in the story. Still saved here.
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  top: { justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  who: { flex: 1 },
  foot: { flexWrap: 'wrap', gap: space.sm },
  hints: { flexShrink: 1 },
  // Dimmed, not hidden. The owner must still be able to read what they excluded.
  excluded: { opacity: 0.55 },
  notice: { borderTopWidth: 1, paddingTop: space.sm },
});
