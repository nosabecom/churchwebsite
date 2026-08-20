import {EnvelopeIcon} from '@sanity/icons/Envelope'
import {defineField, defineType} from 'sanity'
import {PublicationDateSlugInput} from '../../components/publication-date-slug-input'
import {isIssueNumberUniqueWithinSite} from '../shared/site-issue-number'
import {isSlugUniqueWithinSite} from '../shared/site-slug-is-unique'
import {siteOwnershipField, siteTitle} from '../shared/sites'

export const newsletterIssue = defineType({
  name: 'newsletterIssue',
  title: 'Newsletter issue',
  type: 'document',
  icon: EnvelopeIcon,
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    {...siteOwnershipField, group: 'content'},
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      description:
        'Generated from the publication month. Another issue in the same month appends its issue number.',
      readOnly: true,
      components: {input: PublicationDateSlugInput},
      options: {
        source: 'publishedAt',
        maxLength: 96,
        isUnique: isSlugUniqueWithinSite,
      },
      validation: (rule) =>
        rule.required().custom((slug) => {
          if (!slug?.current) return true
          return (
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.current) ||
            'Use lowercase letters, numbers, and single hyphens only.'
          )
        }),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Publication date',
      type: 'date',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'issue',
      title: 'Issue number',
      type: 'number',
      group: 'content',
      description: 'Assigned automatically from the highest issue number for the owning site.',
      readOnly: true,
      validation: (rule) =>
        rule.required().integer().positive().custom(isIssueNumberUniqueWithinSite),
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      group: 'content',
      validation: (rule) => rule.required().max(240),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      type: 'editorialImage',
      group: 'content',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
      group: 'content',
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'relatedLink',
      title: 'Related link',
      type: 'link',
      group: 'content',
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
      group: 'seo',
    }),
    defineField({
      name: 'migrationMetadata',
      title: 'Migration metadata',
      type: 'migrationMetadata',
      readOnly: true,
      hidden: true,
    }),
  ],
  orderings: [
    {
      title: 'Issue number, newest first',
      name: 'issueDesc',
      by: [
        {field: 'issue', direction: 'desc'},
        {field: 'publishedAt', direction: 'desc'},
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      site: 'site',
      publishedAt: 'publishedAt',
      issue: 'issue',
      media: 'coverImage',
    },
    prepare: ({title, site, publishedAt, issue, media}) => {
      const details = [siteTitle(site), publishedAt, issue ? `Issue ${issue}` : undefined]

      return {
        title: title || 'Untitled newsletter issue',
        subtitle: details.filter(Boolean).join(' · '),
        media,
      }
    },
  },
})
