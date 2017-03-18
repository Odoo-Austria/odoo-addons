# -*- coding: utf-8 -*-
{
    'name': 'MPD Six Payment Terminal',
    'version': '10.0.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'MPD Six Payment Terminal Integration Odoo POS',
    'website': 'https://www.callino.at/page/mpd',
    'description': """
MPD Integration Six Payment
===========================


""",
    'author': 'Wolfgang Pichler',
    'depends': ['point_of_sale'],
    'test': [
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/templates.xml',
        'views/account_journal.xml',
        'views/pos_config.xml',
    ],
    'qweb': ['static/src/xml/pos.xml'],
    'installable': True,
    'auto_install': False,
}
