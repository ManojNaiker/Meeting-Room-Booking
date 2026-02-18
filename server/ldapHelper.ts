import ldap from 'ldapjs';
import type { EmailSettings } from '@shared/schema';

export interface LdapUser {
  email: string;
  name?: string;
}

export async function searchLdapUsers(
  emailSettings: EmailSettings,
  searchQuery: string = ''
): Promise<LdapUser[]> {
  if (!emailSettings.enableLdap || !emailSettings.ldapHost) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: `ldap://${emailSettings.ldapHost}:${emailSettings.ldapPort || 389}`,
      timeout: 5000,
      connectTimeout: 5000,
    });

    const users: LdapUser[] = [];

    client.on('error', (err) => {
      console.error('LDAP client error:', err);
      client.unbind();
      resolve([]);
    });

    client.bind(emailSettings.ldapBindDn || '', emailSettings.ldapBindPassword || '', (bindErr) => {
      if (bindErr) {
        console.error('LDAP bind error:', bindErr);
        client.unbind();
        resolve([]);
        return;
      }

      const searchFilter = searchQuery 
        ? `(&${emailSettings.ldapSearchFilter || '(mail=*)'}(|(mail=*${searchQuery}*)(cn=*${searchQuery}*)))`
        : emailSettings.ldapSearchFilter || '(mail=*)';

      const opts = {
        filter: searchFilter,
        scope: 'sub' as const,
        attributes: ['mail', 'cn', 'displayName'],
        sizeLimit: 50,
      };

      client.search(emailSettings.ldapBaseDn || '', opts, (searchErr, res) => {
        if (searchErr) {
          console.error('LDAP search error:', searchErr);
          client.unbind();
          resolve([]);
          return;
        }

        res.on('searchEntry', (entry) => {
          const email = entry.attributes.find(attr => attr.type === 'mail')?.values[0];
          const cn = entry.attributes.find(attr => attr.type === 'cn')?.values[0];
          const displayName = entry.attributes.find(attr => attr.type === 'displayName')?.values[0];
          
          if (email) {
            users.push({
              email: String(email),
              name: String(displayName || cn || ''),
            });
          }
        });

        res.on('error', (err) => {
          console.error('LDAP search result error:', err);
          client.unbind();
          resolve([]);
        });

        res.on('end', () => {
          client.unbind();
          resolve(users);
        });
      });
    });
  });
}
