import {CalendarIcon} from '@sanity/icons/Calendar'
import {defineField, defineType} from 'sanity'

const breezeOwned = {
  readOnly: true,
  description: 'Mirrored from Breeze. Change this in Breeze; the next sync updates Sanity.',
} as const

export const event = defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  icon: CalendarIcon,
  groups: [
    {name: 'breeze', title: 'Breeze event', default: true},
    {name: 'website', title: 'Website overrides'},
    {name: 'sync', title: 'Sync details'},
  ],
  fields: [
    defineField({name: 'site', title: 'Owning site', type: 'string', hidden: true, readOnly: true}),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'breeze',
      ...breezeOwned,
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 5,
      group: 'breeze',
      ...breezeOwned,
    }),
    defineField({
      name: 'startsAt',
      title: 'Starts at',
      type: 'datetime',
      group: 'breeze',
      ...breezeOwned,
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'endsAt', title: 'Ends at', type: 'datetime', group: 'breeze', ...breezeOwned}),
    defineField({name: 'allDay', title: 'All day', type: 'boolean', group: 'breeze', ...breezeOwned}),
    defineField({
      name: 'operationalLocation',
      title: 'Location',
      type: 'string',
      group: 'breeze',
      ...breezeOwned,
    }),
    defineField({
      name: 'calendarName',
      title: 'Calendar',
      type: 'string',
      group: 'breeze',
      ...breezeOwned,
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Event link',
      type: 'url',
      group: 'breeze',
      ...breezeOwned,
    }),
    defineField({
      name: 'slug',
      title: 'Website slug',
      type: 'slug',
      group: 'website',
      readOnly: true,
      description: 'Generated once by the sync so links remain stable when a Breeze title changes.',
    }),
    defineField({
      name: 'websiteSummary',
      title: 'Website summary override',
      type: 'text',
      rows: 3,
      group: 'website',
      description: 'Optional. Leave blank to publish the Breeze description.',
      validation: (rule) => rule.max(300),
    }),
    defineField({name: 'image', title: 'Website image', type: 'editorialImage', group: 'website'}),
    defineField({name: 'featured', title: 'Featured', type: 'boolean', group: 'website', initialValue: false}),
    defineField({
      name: 'registrationUrl',
      title: 'Registration URL override',
      type: 'url',
      group: 'website',
      description: 'Optional. Leave blank to publish the event link from Breeze.',
      validation: (rule) => rule.uri({scheme: ['https']}),
    }),
    defineField({name: 'seo', title: 'Search and social metadata', type: 'seo', group: 'website'}),
    defineField({
      name: 'source',
      title: 'Breeze source',
      type: 'object',
      group: 'sync',
      readOnly: true,
      fields: [
        defineField({name: 'system', title: 'System', type: 'string'}),
        defineField({name: 'instanceId', title: 'Instance ID', type: 'string'}),
        defineField({name: 'seriesId', title: 'Series ID', type: 'string'}),
        defineField({name: 'calendarId', title: 'Calendar ID', type: 'string'}),
        defineField({name: 'locationId', title: 'Location ID', type: 'string'}),
        defineField({name: 'isModified', title: 'Modified occurrence', type: 'boolean'}),
        defineField({
          name: 'status',
          title: 'Status',
          type: 'string',
          options: {list: ['active', 'suspect', 'archived']},
        }),
        defineField({name: 'missingSince', title: 'Missing since', type: 'datetime'}),
        defineField({name: 'archivedAt', title: 'Archived at', type: 'datetime'}),
        defineField({name: 'lastChangedAt', title: 'Last source change', type: 'datetime'}),
        defineField({name: 'lastSyncRunId', title: 'Last sync run', type: 'string'}),
      ],
    }),
  ],
  orderings: [
    {title: 'Start time', name: 'startsAtAsc', by: [{field: 'startsAt', direction: 'asc'}]},
  ],
  preview: {
    select: {title: 'title', startsAt: 'startsAt', calendar: 'calendarName', status: 'source.status', media: 'image'},
    prepare: ({title, startsAt, calendar, status, media}) => ({
      title: title || 'Untitled Breeze event',
      subtitle: [startsAt, calendar, status && status !== 'active' ? status : undefined]
        .filter(Boolean)
        .join(' · '),
      media,
    }),
  },
})
