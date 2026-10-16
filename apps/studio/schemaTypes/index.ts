import {newsletterIssue} from './documents/newsletter-issue'
import {event} from './documents/event'
import {editorialImage} from './objects/editorial-image'
import {link} from './objects/link'
import {migrationMetadata} from './objects/migration-metadata'
import {portableText} from './objects/portable-text'
import {seo} from './objects/seo'

export const schemaTypes = [
  link,
  editorialImage,
  seo,
  portableText,
  migrationMetadata,
  event,
  newsletterIssue,
]
